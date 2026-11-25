/**
 * Transparent DOM overlay that captures pointer events when a drawing tool
 * is active (bin, rectangle, circle, polygon). Converts screen coordinates to
 * engine world coordinates and drives tool-specific state machines.
 *
 * Mounted on top of the engine canvas in layout mode only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useLayoutEngineContext, useEngineState } from '@/layout-engine'
import type { LayoutEngine } from '@/layout-engine'
import type { LayoutShape, BinMetadata, LayoutGroup } from '@/layout-engine/types'
import { findBestBinForShape, type ShapeAABB } from '@/layout-engine/containment'
import { shapeTypeLabel } from '@/lib/shape-labels'
import { boxFromDrag, type DrawOptions, type Point } from '@/lib/draw-box'
import { binFromDrag, binOverlaps, type DrawnBin } from '@/lib/draw-bin'
import { addBin } from '@/lib/new-bin'
import { useProject } from '@/hooks/useProject'
import { DEFAULT_GRIDFINITY_CONFIG, newBinDefaults } from '../../../shared/types/project'

// ─── Coordinate conversion ──────────────────────────────────────────────────

function screenToWorld(
  clientX: number,
  clientY: number,
  overlayEl: HTMLDivElement,
  engine: LayoutEngine
): { x: number; y: number } {
  const rect = overlayEl.getBoundingClientRect()
  const vp = engine.getViewport()
  return {
    x: (clientX - rect.left + vp.panX) / vp.zoom,
    y: (clientY - rect.top + vp.panY) / vp.zoom
  }
}

// ─── Shape snap grid ────────────────────────────────────────────────────────
// Shapes snap to a finer grid than bins. Default: no snap (free draw).
// Hold Ctrl or Cmd for fine snap (1mm). This is separate from the engine's bin grid.

const FINE_SNAP = 1 // mm

/** The modifier keys a drawing tool reads from a pointer or key event. */
interface ModifierKeys {
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

function snapShape(value: number, snap: boolean): number {
  if (!snap) return value
  const size = FINE_SNAP
  return Math.round(value / size) * size
}

function snapShapePoint(world: Point, keys: ModifierKeys): Point {
  const snap = keys.ctrlKey || keys.metaKey
  return {
    x: snapShape(world.x, snap),
    y: snapShape(world.y, snap)
  }
}

/** Keys that change the shape being dragged: 1:1, from center, and snap. */
const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'Control', 'Meta'])

/** Alt draws out from the center. Shift keeps the shape square. */
function drawOptions(keys: ModifierKeys): DrawOptions {
  return { fromCenter: keys.altKey, square: keys.shiftKey }
}

// ─── Shape defaults ─────────────────────────────────────────────────────────

const SHAPE_FILL = 'rgba(168, 85, 247, 0.12)'
const SHAPE_STROKE = '#a855f7'
const SHAPE_STROKE_WIDTH = 1

const PREVIEW_FILL = 'rgba(168, 85, 247, 0.06)'
const PREVIEW_STROKE = 'rgba(168, 85, 247, 0.5)'
const PREVIEW_STROKE_WIDTH = 1

function baseShapeProps(): Pick<
  LayoutShape,
  'rotation' | 'fill' | 'stroke' | 'strokeWidth' | 'groupId'
> {
  return {
    rotation: 0,
    fill: SHAPE_FILL,
    stroke: SHAPE_STROKE,
    strokeWidth: SHAPE_STROKE_WIDTH,
    groupId: null
  }
}

// ─── Shape naming ───────────────────────────────────────────────────────────

function nextShapeName(engine: LayoutEngine, type: LayoutShape['type']): string {
  const label = shapeTypeLabel(type)
  const shapes = engine.getAllShapes()
  let max = 0
  for (const s of shapes) {
    const name = s.metadata?.name as string | undefined
    if (name?.startsWith(label + ' ')) {
      const num = parseInt(name.slice(label.length + 1), 10)
      if (!isNaN(num) && num > max) max = num
    }
  }
  return `${label} ${max + 1}`
}

// ─── Bin hit testing ────────────────────────────────────────────────────────

/**
 * Find the bin a newly drawn shape should be assigned to. Uses AABB overlap
 * with a centroid-containment tiebreak so shapes whose centroid lands a hair
 * outside a bin (snap-to-grid edge cases, drag started just outside) still
 * get assigned when they visually cover the bin.
 */
function findBinForDrawnShape(
  engine: LayoutEngine,
  aabb: ShapeAABB
): (LayoutGroup & { metadata: BinMetadata }) | null {
  return findBestBinForShape(engine.getAllGroups(), aabb)
}

function pocketMetadata(
  bin: (LayoutGroup & { metadata: BinMetadata }) | null
): Record<string, unknown> | undefined {
  if (!bin) return undefined
  // Newly drawn shapes start in "auto" mode (depth === undefined). The bake
  // loop falls back to computeDefaultPocketDepth via `?? computeDefault…`,
  // so the produced geometry is identical, but the sidebar can distinguish
  // a true user override from the historical default.
  return {
    pocket: {
      clearance: 0.25
    }
  }
}

// ─── Drawing state (shared across tools) ────────────────────────────────────

interface DrawingState {
  polygonVertices: { x: number; y: number }[]
  polygonCursor: { x: number; y: number } | null
  polygonNearClose: boolean
}

const INITIAL_STATE: DrawingState = {
  polygonVertices: [],
  polygonCursor: null,
  polygonNearClose: false
}

const CLOSE_SNAP_DISTANCE_PX = 10

/** A drag must make a shape wider and taller than this, in mm, or nothing is drawn. */
const MIN_DRAWN_SIZE = 2

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DrawingToolLayer(): React.JSX.Element | null {
  const { activeTool, setActiveTool } = useAppMode()
  const { engine } = useLayoutEngineContext()
  const { viewport } = useEngineState()

  // Reset polygon state when switching away from polygon tool.

  const prevToolRef = useRef(activeTool)
  const [state, setState] = useState<DrawingState>(INITIAL_STATE)

  /* eslint-disable react-hooks/refs -- intentional previous-value tracking pattern */
  if (prevToolRef.current !== activeTool) {
    prevToolRef.current = activeTool
    if (activeTool !== 'polygon' && state !== INITIAL_STATE) {
      setState(INITIAL_STATE)
    }
  }
  /* eslint-enable react-hooks/refs */

  // Refs for drag state (rect/circle) — not rendered, so ref is fine
  const dragStartRef = useRef<Point | null>(null)
  // Where the pointer last was, before any snap, so a modifier key pressed mid-drag can
  // redraw the preview.
  const dragCurrentRef = useRef<Point | null>(null)
  // Rect/circle preview while dragging. Drawn in the overlay, never added to
  // the engine, so it cannot reach undo history, the sidebar or a saved file.
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  // Guard against double finishPolygon calls (StrictMode)
  const finishingRef = useRef(false)

  // ─── Cleanup on tool switch ─────────────────────────────────────────────

  const cleanupPreview = useCallback(() => {
    dragStartRef.current = null
    dragCurrentRef.current = null
    setDragPreview(null)
  }, [])

  // Pressing or letting go of a modifier key during a drag changes the shape straight away,
  // without waiting for the pointer to move. Esc calls the drag off.
  const isDragging = dragPreview !== null
  useEffect(() => {
    if (!isDragging) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (e.type === 'keydown') cleanupPreview()
        return
      }
      if (!MODIFIER_KEYS.has(e.key)) return
      const start = dragStartRef.current
      const pointer = dragCurrentRef.current
      if (!start || !pointer) return
      // Alt on its own would otherwise move focus to the window menu on Windows and Linux.
      if (e.key === 'Alt') e.preventDefault()
      // A held key repeats its keydown. Nothing has changed since the first one.
      if (e.repeat) return
      // A bin fills whole grid cells whatever keys are held.
      if (activeTool === 'bin') return
      setDragPreview({ start, current: snapShapePoint(pointer, e), options: drawOptions(e) })
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [isDragging, activeTool, cleanupPreview])

  useEffect(() => {
    return () => {
      cleanupPreview()
    }
  }, [activeTool, cleanupPreview])

  // ─── Finish polygon ───────────────────────────────────────────────────────

  const finishPolygon = useCallback(
    (pts: { x: number; y: number }[]) => {
      if (!engine || pts.length < 3) {
        setState(INITIAL_STATE)
        finishingRef.current = false
        return
      }

      // Guard against StrictMode double-fire
      if (finishingRef.current) return
      finishingRef.current = true

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of pts) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      // A polygon's position is the center of the box around it, and its points are measured
      // from there. Anything else and it would jump as it is added.
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const relativePoints = pts.map((p) => ({ x: p.x - cx, y: p.y - cy }))
      const bin = findBinForDrawnShape(engine, { minX, minY, maxX, maxY })
      const id = crypto.randomUUID()
      const name = nextShapeName(engine, 'polygon')

      // Create ungrouped at world coords, then reparent via addToGroup which
      // handles world→local conversion. Passing groupId directly to addShape
      // would treat x/y as already group-local and place the shape at the
      // wrong position. Batched so creating and assigning is one undo step.
      engine.batch(() => {
        engine.addShape({
          id,
          type: 'polygon',
          x: cx,
          y: cy,
          points: relativePoints,
          ...baseShapeProps(),
          groupId: null,
          metadata: { ...pocketMetadata(bin), name }
        })
        if (bin) engine.addToGroup(id, bin.id)
      })
      engine.select([id])
      setState(INITIAL_STATE)
      setActiveTool('select')

      // Reset guard after microtask
      queueMicrotask(() => {
        finishingRef.current = false
      })
    },
    [engine, setActiveTool]
  )

  // ─── Escape / Enter for polygon ──────────────────────────────────────────

  useEffect(() => {
    if (activeTool !== 'polygon') return
    const handler = (e: KeyboardEvent): void => {
      // Enter and Esc in a text field belong to the field.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        setState(INITIAL_STATE)
      } else if (e.key === 'Enter') {
        setState((prev) => {
          if (prev.polygonVertices.length >= 3) {
            queueMicrotask(() => finishPolygon(prev.polygonVertices))
          }
          return prev
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTool, finishPolygon])

  // ─── Pointer handlers ─────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const overlay = overlayRef.current
      if (!engine || !overlay || e.button !== 0) return
      const world = screenToWorld(e.clientX, e.clientY, overlay, engine)
      const snapped = snapShapePoint(world, e)

      if (activeTool === 'bin') {
        // A bin snaps to whole grid cells, so the pointer is used as it is.
        dragStartRef.current = world
        dragCurrentRef.current = world
        setDragPreview({ start: world, current: world, options: drawOptions(e) })
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } else if (activeTool === 'rectangle' || activeTool === 'circle') {
        dragStartRef.current = snapped
        dragCurrentRef.current = world
        setDragPreview({ start: snapped, current: snapped, options: drawOptions(e) })
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } else if (activeTool === 'polygon') {
        setState((prev) => {
          const verts = prev.polygonVertices

          // Close-snap (screen-space threshold for consistent UX across zoom levels)
          if (verts.length >= 3) {
            const first = verts[0]
            const dist = Math.sqrt((snapped.x - first.x) ** 2 + (snapped.y - first.y) ** 2)
            const threshold = CLOSE_SNAP_DISTANCE_PX / viewport.zoom
            if (dist < threshold) {
              queueMicrotask(() => finishPolygon(verts))
              return prev
            }
          }

          // Double-click to finish
          if (e.detail >= 2 && verts.length >= 3) {
            queueMicrotask(() => finishPolygon(verts))
            return prev
          }

          return { ...prev, polygonVertices: [...verts, snapped] }
        })
      }
    },
    [engine, activeTool, finishPolygon, viewport.zoom]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const overlay = overlayRef.current
      if (!engine || !overlay) return
      const world = screenToWorld(e.clientX, e.clientY, overlay, engine)

      if (activeTool === 'bin' && dragStartRef.current) {
        dragCurrentRef.current = world
        setDragPreview({ start: dragStartRef.current, current: world, options: drawOptions(e) })
      } else if ((activeTool === 'rectangle' || activeTool === 'circle') && dragStartRef.current) {
        dragCurrentRef.current = world
        setDragPreview({
          start: dragStartRef.current,
          current: snapShapePoint(world, e),
          options: drawOptions(e)
        })
      } else if (activeTool === 'polygon') {
        const snapped = snapShapePoint(world, e)
        setState((prev) => {
          if (prev.polygonVertices.length === 0) return prev
          let nearClose = false
          if (prev.polygonVertices.length >= 3) {
            const first = prev.polygonVertices[0]
            const dist = Math.sqrt((snapped.x - first.x) ** 2 + (snapped.y - first.y) ** 2)
            const threshold = CLOSE_SNAP_DISTANCE_PX / viewport.zoom
            nearClose = dist < threshold
          }
          return {
            ...prev,
            polygonCursor: snapped,
            polygonNearClose: nearClose
          }
        })
      }
    },
    [engine, activeTool, viewport.zoom]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const overlay = overlayRef.current
      if (!engine || !overlay) return
      if (activeTool !== 'bin' && activeTool !== 'rectangle' && activeTool !== 'circle') return
      if (!dragStartRef.current) return

      const world = screenToWorld(e.clientX, e.clientY, overlay, engine)
      if (activeTool === 'bin') {
        const cell = engine.getGridConfig().size
        const bin = binFromDrag(dragStartRef.current, world, cell)
        setDragPreview(null)
        dragStartRef.current = null
        dragCurrentRef.current = null
        // A bin can't sit on another. The preview has already shown there is no room.
        if (binOverlaps(engine.getAllGroups(), bin)) return
        const settings = useProject.getState().project?.gridfinity ?? DEFAULT_GRIDFINITY_CONFIG
        addBin(engine, bin, cell, newBinDefaults(settings), { adoptShapes: true })
        setActiveTool('select')
        return
      }
      const snapped = snapShapePoint(world, e)
      const start = dragStartRef.current

      setDragPreview(null)

      const box = boxFromDrag(start, snapped, drawOptions(e))
      const w = box.maxX - box.minX
      const h = box.maxY - box.minY
      if (w > MIN_DRAWN_SIZE && h > MIN_DRAWN_SIZE) {
        const type = activeTool === 'rectangle' ? 'rect' : 'circle'
        const center = { x: box.minX + w / 2, y: box.minY + h / 2 }
        const bin = findBinForDrawnShape(engine, box)
        const id = crypto.randomUUID()
        const common = {
          id,
          ...center,
          ...baseShapeProps(),
          groupId: null,
          metadata: { ...pocketMetadata(bin), name: nextShapeName(engine, type) }
        }
        engine.batch(() => {
          engine.addShape(
            type === 'rect'
              ? { ...common, type, width: w, height: h }
              : { ...common, type, radiusX: w / 2, radiusY: h / 2 }
          )
          if (bin) engine.addToGroup(id, bin.id)
        })
        engine.select([id])
        setActiveTool('select')
      }

      dragStartRef.current = null
      dragCurrentRef.current = null
    },
    [engine, activeTool, setActiveTool]
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!activeTool || activeTool === 'select' || !engine) return null

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20"
      style={{ cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cleanupPreview}
      onLostPointerCapture={cleanupPreview}
    >
      {dragPreview && activeTool === 'bin' && (
        <BinPreviewSvg
          bin={binFromDrag(dragPreview.start, dragPreview.current, engine.getGridConfig().size)}
          engine={engine}
          viewport={viewport}
        />
      )}
      {dragPreview && (activeTool === 'rectangle' || activeTool === 'circle') && (
        <DragPreviewSvg tool={activeTool} preview={dragPreview} viewport={viewport} />
      )}
      {activeTool === 'polygon' && state.polygonVertices.length > 0 && (
        <PolygonPreviewSvg
          vertices={state.polygonVertices}
          cursor={state.polygonCursor}
          isNearClose={state.polygonNearClose}
          viewport={viewport}
        />
      )}
    </div>
  )
}

// ─── SVG Overlay for rect/circle drag preview ───────────────────────────────

interface DragPreview {
  start: Point
  current: Point
  options: DrawOptions
}

function DragPreviewSvg({
  tool,
  preview,
  viewport
}: {
  tool: 'rectangle' | 'circle'
  preview: DragPreview
  viewport: { panX: number; panY: number; zoom: number }
}): React.JSX.Element {
  const sx = (wx: number): number => wx * viewport.zoom - viewport.panX
  const sy = (wy: number): number => wy * viewport.zoom - viewport.panY
  const box = boxFromDrag(preview.start, preview.current, preview.options)
  const width = (box.maxX - box.minX) * viewport.zoom
  const height = (box.maxY - box.minY) * viewport.zoom
  const style = {
    fill: PREVIEW_FILL,
    stroke: PREVIEW_STROKE,
    strokeWidth: PREVIEW_STROKE_WIDTH
  }

  return (
    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
      {tool === 'rectangle' ? (
        <rect x={sx(box.minX)} y={sy(box.minY)} width={width} height={height} {...style} />
      ) : (
        <ellipse
          cx={sx(box.minX) + width / 2}
          cy={sy(box.minY) + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...style}
        />
      )}
    </svg>
  )
}

// ─── SVG Overlay for the bin drag preview ───────────────────────────────────

const BIN_PREVIEW = { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6' }
const BIN_PREVIEW_BLOCKED = { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444' }

/** The bin being drawn, with its size in grid units. Red when there is no room for it. */
function BinPreviewSvg({
  bin,
  engine,
  viewport
}: {
  bin: DrawnBin
  engine: LayoutEngine
  viewport: { panX: number; panY: number; zoom: number }
}): React.JSX.Element {
  const x = bin.x * viewport.zoom - viewport.panX
  const y = (bin.y - bin.height) * viewport.zoom - viewport.panY
  const width = bin.width * viewport.zoom
  const height = bin.height * viewport.zoom
  const blocked = binOverlaps(engine.getAllGroups(), bin)
  const colors = blocked ? BIN_PREVIEW_BLOCKED : BIN_PREVIEW

  return (
    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
      <rect x={x} y={y} width={width} height={height} rx={4} strokeWidth={1.5} {...colors} />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill={colors.stroke}
      >
        {blocked ? 'No room' : `${bin.widthUnits}×${bin.depthUnits}`}
      </text>
    </svg>
  )
}

// ─── SVG Overlay for polygon preview ────────────────────────────────────────

function PolygonPreviewSvg({
  vertices,
  cursor,
  isNearClose,
  viewport
}: {
  vertices: { x: number; y: number }[]
  cursor: { x: number; y: number } | null
  isNearClose: boolean
  viewport: { panX: number; panY: number; zoom: number }
}): React.JSX.Element {
  const toScreen = (wx: number, wy: number): { sx: number; sy: number } => ({
    sx: wx * viewport.zoom - viewport.panX,
    sy: wy * viewport.zoom - viewport.panY
  })

  const screenVerts = vertices.map((v) => toScreen(v.x, v.y))
  const cursorScreen = cursor ? toScreen(cursor.x, cursor.y) : null

  const allPoints = [...screenVerts, ...(cursorScreen ? [cursorScreen] : [])]
  const pathData =
    allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx} ${p.sy}`).join(' ') +
    (isNearClose ? ' Z' : '')

  return (
    <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
      {allPoints.length >= 3 && <path d={pathData} fill={PREVIEW_FILL} stroke="none" />}
      <path
        d={pathData}
        fill="none"
        stroke={PREVIEW_STROKE}
        strokeWidth={PREVIEW_STROKE_WIDTH}
        strokeDasharray="4 3"
      />
      {screenVerts.map((p, i) => (
        <circle
          key={i}
          cx={p.sx}
          cy={p.sy}
          r={i === 0 && isNearClose ? 6 : 3}
          fill={i === 0 && isNearClose ? 'rgba(168, 85, 247, 0.3)' : SHAPE_STROKE}
          stroke={i === 0 && isNearClose ? SHAPE_STROKE : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}
