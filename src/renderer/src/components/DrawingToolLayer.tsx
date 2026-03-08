/**
 * Transparent DOM overlay that captures pointer events when a drawing tool
 * is active (rectangle, circle, polygon). Converts screen coordinates to
 * engine world coordinates and drives tool-specific state machines.
 *
 * Mounted on top of the engine canvas in layout mode only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useLayoutEngineContext, useEngineState } from '@/layout-engine'
import type { LayoutEngine } from '@/layout-engine'
import type { LayoutShape, BinMetadata } from '@/layout-engine/types'
import { isBinGroup } from '@/layout-engine/types'

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

// ─── Grid snap helper ───────────────────────────────────────────────────────

function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return value
  return Math.round(value / gridSize) * gridSize
}

function snapPoint(
  world: { x: number; y: number },
  engine: LayoutEngine
): { x: number; y: number } {
  const grid = engine.getGridConfig()
  return {
    x: snapToGrid(world.x, grid.size, grid.enabled),
    y: snapToGrid(world.y, grid.size, grid.enabled)
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

// ─── Bin hit testing ────────────────────────────────────────────────────────

function pocketMetadata(
  engine: LayoutEngine,
  worldX: number,
  worldY: number
): Record<string, unknown> | undefined {
  const groups = engine.getAllGroups()
  for (const group of groups) {
    if (!isBinGroup(group)) continue
    if (
      worldX >= group.x &&
      worldX <= group.x + group.width &&
      worldY <= group.y &&
      worldY >= group.y - group.height
    ) {
      const meta = group.metadata as BinMetadata
      return {
        pocket: {
          depth: meta.heightUnits * 7,
          clearance: 0.25
        }
      }
    }
  }
  return undefined
}

function findContainingGroup(engine: LayoutEngine, worldX: number, worldY: number): string | null {
  const groups = engine.getAllGroups()
  for (const group of groups) {
    if (!isBinGroup(group)) continue
    if (
      worldX >= group.x &&
      worldX <= group.x + group.width &&
      worldY <= group.y &&
      worldY >= group.y - group.height
    ) {
      return group.id
    }
  }
  return null
}

// ─── Drawing state (shared across tools) ────────────────────────────────────

interface DrawingState {
  /** Polygon vertices (absolute world coords) */
  polygonVertices: { x: number; y: number }[]
  /** Current cursor position for polygon preview */
  polygonCursor: { x: number; y: number } | null
  /** Whether cursor is near first polygon vertex */
  polygonNearClose: boolean
}

const INITIAL_STATE: DrawingState = {
  polygonVertices: [],
  polygonCursor: null,
  polygonNearClose: false
}

const CLOSE_SNAP_DISTANCE = 10

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DrawingToolLayer(): React.JSX.Element | null {
  const { activeTool, setActiveTool } = useAppMode()
  const { engine } = useLayoutEngineContext()
  const { viewport } = useEngineState()

  // Reset polygon state when switching away from polygon tool.
  // This is the React-recommended "adjusting state during render" pattern.
  const prevToolRef = useRef(activeTool)
  const [state, setState] = useState<DrawingState>(INITIAL_STATE)
  // eslint-disable-next-line react-hooks/refs -- prevToolRef tracks prop transitions during render (React docs pattern)
  if (prevToolRef.current !== activeTool) {
    // eslint-disable-next-line react-hooks/refs -- writing tracked prop value
    prevToolRef.current = activeTool
    if (activeTool !== 'polygon' && state !== INITIAL_STATE) {
      setState(INITIAL_STATE)
    }
  }

  // Refs for drag state (rect/circle) — not rendered, so ref is fine
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const previewIdRef = useRef<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // ─── Cleanup on tool switch ─────────────────────────────────────────────

  const cleanupPreview = useCallback(() => {
    if (previewIdRef.current && engine) {
      engine.removeShape(previewIdRef.current)
    }
    previewIdRef.current = null
    dragStartRef.current = null
  }, [engine])

  useEffect(() => {
    // When tool changes away from a drawing tool, clean up
    return () => {
      cleanupPreview()
    }
  }, [activeTool, cleanupPreview])

  // ─── Escape / Enter for polygon ──────────────────────────────────────────

  const finishPolygon = useCallback(
    (pts: { x: number; y: number }[]) => {
      if (!engine || pts.length < 3) {
        setState(INITIAL_STATE)
        return
      }

      const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length
      const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length
      const relativePoints = pts.map((p) => ({ x: p.x - cx, y: p.y - cy }))

      const groupId = findContainingGroup(engine, cx, cy)
      const id = crypto.randomUUID()

      engine.addShape({
        id,
        type: 'polygon',
        x: cx,
        y: cy,
        points: relativePoints,
        ...baseShapeProps(),
        groupId,
        metadata: pocketMetadata(engine, cx, cy)
      })
      engine.select([id])
      setState(INITIAL_STATE)
      setActiveTool('select')
    },
    [engine, setActiveTool]
  )

  useEffect(() => {
    if (activeTool !== 'polygon') return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setState(INITIAL_STATE)
      } else if (e.key === 'Enter') {
        setState((prev) => {
          if (prev.polygonVertices.length >= 3) {
            // Schedule finishPolygon outside setState
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
      const snapped = snapPoint(world, engine)

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

          // Close-snap
          if (verts.length >= 3) {
            const first = verts[0]
            const dist = Math.sqrt((snapped.x - first.x) ** 2 + (snapped.y - first.y) ** 2)
            if (dist < CLOSE_SNAP_DISTANCE) {
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
    [engine, activeTool, finishPolygon]
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
        const snapped = snapPoint(world, engine)
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
          const dx = world.x - start.x
          const dy = world.y - start.y
          const radius = Math.sqrt(dx * dx + dy * dy)
          engine.updateShape(previewIdRef.current, {
            radiusX: radius,
            radiusY: radius
          } as Partial<LayoutShape>)
        }
      } else if (activeTool === 'polygon') {
        const snapped = snapPoint(world, engine)
        setState((prev) => {
          if (prev.polygonVertices.length === 0) return prev
          let nearClose = false
          if (prev.polygonVertices.length >= 3) {
            const first = prev.polygonVertices[0]
            const dist = Math.sqrt((snapped.x - first.x) ** 2 + (snapped.y - first.y) ** 2)
            nearClose = dist < CLOSE_SNAP_DISTANCE
          }
          return {
            ...prev,
            polygonCursor: snapped,
            polygonNearClose: nearClose
          }
        })
      }
    },
    [engine, activeTool]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const overlay = overlayRef.current
      if (!engine || !overlay) return
      if (activeTool !== 'rectangle' && activeTool !== 'circle') return
      if (!dragStartRef.current || !previewIdRef.current) return

      const world = screenToWorld(e.clientX, e.clientY, overlay, engine)
      const snapped = snapPoint(world, engine)
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
          const groupId = findContainingGroup(engine, cx, cy)
          const id = crypto.randomUUID()
          engine.addShape({
            id,
            type: 'rect',
            x: cx,
            y: cy,
            width: w,
            height: h,
            ...baseShapeProps(),
            groupId,
            metadata: pocketMetadata(engine, cx, cy)
          })
          engine.select([id])
          setActiveTool('select')
        }
      } else {
        const dx = world.x - start.x
        const dy = world.y - start.y
        const radius = Math.sqrt(dx * dx + dy * dy)
        if (radius > 2) {
          const groupId = findContainingGroup(engine, start.x, start.y)
          const id = crypto.randomUUID()
          engine.addShape({
            id,
            type: 'circle',
            x: start.x,
            y: start.y,
            radiusX: radius,
            radiusY: radius,
            ...baseShapeProps(),
            groupId,
            metadata: pocketMetadata(engine, start.x, start.y)
          })
          engine.select([id])
          setActiveTool('select')
        }
      }

      dragStartRef.current = null
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
