/**
 * Transparent DOM overlay that captures pointer events when a drawing tool
 * is active (rectangle, circle, polygon). Converts screen coordinates to
 * engine world coordinates and drives tool-specific state machines.
 *
 * Mounted on top of the engine canvas in layout mode only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useLayoutEngineContext, useEngineState } from '@/layout-engine'
import type { LayoutEngine } from '@/layout-engine'
import type { LayoutShape, BinMetadata, LayoutGroup } from '@/layout-engine/types'
import { findBestBinForShape, type ShapeAABB } from '@/layout-engine/containment'
import { computeDefaultPocketDepth } from '../../../shared/types/project'

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
// Hold Shift for fine snap (1mm). This is separate from the engine's bin grid.

const FINE_SNAP = 1 // mm

function snapShape(value: number, shiftHeld: boolean): number {
  if (!shiftHeld) return value
  const size = FINE_SNAP
  return Math.round(value / size) * size
}

function snapShapePoint(
  world: { x: number; y: number },
  shiftHeld: boolean
): { x: number; y: number } {
  return {
    x: snapShape(world.x, shiftHeld),
    y: snapShape(world.y, shiftHeld)
  }
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

const SHAPE_TYPE_LABELS: Record<string, string> = {
  rect: 'Rectangle',
  circle: 'Ellipse',
  polygon: 'Polygon'
}

function nextShapeName(engine: LayoutEngine, type: string): string {
  const label = SHAPE_TYPE_LABELS[type] ?? type
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
  bin: (LayoutGroup & { metadata: BinMetadata }) | null,
  unitHeight: number
): Record<string, unknown> | undefined {
  if (!bin) return undefined
  return {
    pocket: {
      depth: computeDefaultPocketDepth(bin.metadata.heightUnits, unitHeight),
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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DrawingToolLayer(): React.JSX.Element | null {
  const { activeTool, setActiveTool } = useAppMode()
  const { engine } = useLayoutEngineContext()
  const { viewport } = useEngineState()
  const unitHeight = useProject((s) => s.project?.gridfinity.unitHeight ?? 7)

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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const previewIdRef = useRef<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  // Guard against double finishPolygon calls (StrictMode)
  const finishingRef = useRef(false)

  // ─── Cleanup on tool switch ─────────────────────────────────────────────

  const cleanupPreview = useCallback(() => {
    if (previewIdRef.current && engine) {
      engine.removeShape(previewIdRef.current)
    }
    previewIdRef.current = null
    dragStartRef.current = null
  }, [engine])

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

      const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length
      const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length
      const relativePoints = pts.map((p) => ({ x: p.x - cx, y: p.y - cy }))

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
      const bin = findBinForDrawnShape(engine, { minX, minY, maxX, maxY })
      const id = crypto.randomUUID()
      const name = nextShapeName(engine, 'polygon')

      // Create ungrouped at world coords, then reparent via addToGroup which
      // handles world→local conversion. Passing groupId directly to addShape
      // would treat x/y as already group-local and place the shape at the
      // wrong position.
      engine.addShape({
        id,
        type: 'polygon',
        x: cx,
        y: cy,
        points: relativePoints,
        ...baseShapeProps(),
        groupId: null,
        metadata: { ...pocketMetadata(bin, unitHeight), name }
      })
      if (bin) engine.addToGroup(id, bin.id)
      engine.select([id])
      setState(INITIAL_STATE)
      setActiveTool('select')

      // Reset guard after microtask
      queueMicrotask(() => {
        finishingRef.current = false
      })
    },
    [engine, setActiveTool, unitHeight]
  )

  // ─── Escape / Enter for polygon ──────────────────────────────────────────

  useEffect(() => {
    if (activeTool !== 'polygon') return
    const handler = (e: KeyboardEvent): void => {
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
      const snapped = snapShapePoint(world, e.shiftKey)

      if (activeTool === 'rectangle' || activeTool === 'circle') {
        dragStartRef.current = snapped
        const id = `preview-${activeTool}-${crypto.randomUUID()}`
        previewIdRef.current = id

        if (activeTool === 'rectangle') {
          engine.addShape({
            id,
            type: 'rect',
            x: snapped.x,
            y: snapped.y,
            width: 0,
            height: 0,
            ...baseShapeProps(),
            fill: PREVIEW_FILL,
            stroke: PREVIEW_STROKE,
            strokeWidth: PREVIEW_STROKE_WIDTH,
            groupId: null
          })
        } else {
          engine.addShape({
            id,
            type: 'circle',
            x: snapped.x,
            y: snapped.y,
            radiusX: 0,
            radiusY: 0,
            ...baseShapeProps(),
            fill: PREVIEW_FILL,
            stroke: PREVIEW_STROKE,
            strokeWidth: PREVIEW_STROKE_WIDTH,
            groupId: null
          })
        }
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

      if (
        (activeTool === 'rectangle' || activeTool === 'circle') &&
        dragStartRef.current &&
        previewIdRef.current
      ) {
        const snapped = snapShapePoint(world, e.shiftKey)
        const start = dragStartRef.current

        if (activeTool === 'rectangle') {
          const x = Math.min(start.x, snapped.x)
          const y = Math.min(start.y, snapped.y)
          const w = Math.abs(snapped.x - start.x)
          const h = Math.abs(snapped.y - start.y)
          engine.updateShape(previewIdRef.current, {
            x: x + w / 2,
            y: y + h / 2,
            width: w,
            height: h
          } as Partial<LayoutShape>)
        } else {
          const dx = snapped.x - start.x
          const dy = snapped.y - start.y
          const radius = Math.sqrt(dx * dx + dy * dy)
          engine.updateShape(previewIdRef.current, {
            radiusX: radius,
            radiusY: radius
          } as Partial<LayoutShape>)
        }
      } else if (activeTool === 'polygon') {
        const snapped = snapShapePoint(world, e.shiftKey)
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
      if (activeTool !== 'rectangle' && activeTool !== 'circle') return
      if (!dragStartRef.current || !previewIdRef.current) return

      const world = screenToWorld(e.clientX, e.clientY, overlay, engine)
      const snapped = snapShapePoint(world, e.shiftKey)
      const start = dragStartRef.current

      // Remove preview
      engine.removeShape(previewIdRef.current)
      previewIdRef.current = null

      if (activeTool === 'rectangle') {
        const w = Math.abs(snapped.x - start.x)
        const h = Math.abs(snapped.y - start.y)
        if (w > 2 && h > 2) {
          const x = Math.min(start.x, snapped.x)
          const y = Math.min(start.y, snapped.y)
          const cx = x + w / 2
          const cy = y + h / 2
          const bin = findBinForDrawnShape(engine, {
            minX: x,
            minY: y,
            maxX: x + w,
            maxY: y + h
          })
          const id = crypto.randomUUID()
          const name = nextShapeName(engine, 'rect')
          engine.addShape({
            id,
            type: 'rect',
            x: cx,
            y: cy,
            width: w,
            height: h,
            ...baseShapeProps(),
            groupId: null,
            metadata: { ...pocketMetadata(bin, unitHeight), name }
          })
          if (bin) engine.addToGroup(id, bin.id)
          engine.select([id])
          setActiveTool('select')
        }
      } else {
        const dx = snapped.x - start.x
        const dy = snapped.y - start.y
        const radius = Math.sqrt(dx * dx + dy * dy)
        if (radius > 2) {
          const bin = findBinForDrawnShape(engine, {
            minX: start.x - radius,
            minY: start.y - radius,
            maxX: start.x + radius,
            maxY: start.y + radius
          })
          const id = crypto.randomUUID()
          const name = nextShapeName(engine, 'circle')
          engine.addShape({
            id,
            type: 'circle',
            x: start.x,
            y: start.y,
            radiusX: radius,
            radiusY: radius,
            ...baseShapeProps(),
            groupId: null,
            metadata: { ...pocketMetadata(bin, unitHeight), name }
          })
          if (bin) engine.addToGroup(id, bin.id)
          engine.select([id])
          setActiveTool('select')
        }
      }

      dragStartRef.current = null
    },
    [engine, activeTool, setActiveTool, unitHeight]
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
    >
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
