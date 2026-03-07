import { useState, useRef, useCallback, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useProject } from '@/hooks/useProject'
import { binOverlapsAny } from '@/lib/collision'
import { Z } from '@/lib/z-layers'
import type { Bin } from '../../../../shared/types/project'

type BinResizeEdge = 'e' | 'w' | 'n' | 's'

interface BinInteractionManagerProps {
  bin: Bin
  baseUnit: number
  selected: boolean
  selectedBinIds: Set<string>
  allBins: Bin[]
  otherBins: Bin[]
  onSelectBin: (id: string, additive?: boolean) => void
  onBinMove: (id: string, dx: number, dy: number) => void
  onBinResize?: (id: string, patch: Partial<Bin>) => void
  onBinHover?: (id: string | null) => void
}

/**
 * Owns all bin pointer-event logic: click-to-select, drag, resize, hover.
 * BinFootprint is the visual counterpart — it has zero pointer handlers.
 */
export default function BinInteractionManager({
  bin,
  baseUnit,
  selected,
  selectedBinIds,
  allBins,
  otherBins,
  onSelectBin,
  onBinMove,
  onBinResize,
  onBinHover
}: BinInteractionManagerProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const [resizingEdge, setResizingEdge] = useState<BinResizeEdge | null>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const lastSnappedRef = useRef({ x: 0, y: 0 })

  const widthMm = bin.width * baseUnit
  const depthMm = bin.depth * baseUnit
  const cx = bin.position.x + widthMm / 2
  const cy = bin.position.y + depthMm / 2

  // Pre-compute other bin rects for collision checks
  const otherRects = useMemo(
    () =>
      otherBins.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        w: b.width * baseUnit,
        d: b.depth * baseUnit
      })),
    [otherBins, baseUnit]
  )

  const startDrag = useProject((s) => s.startDrag)
  const endDrag = useProject((s) => s.endDrag)

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.nativeEvent.button !== 0) return
      e.stopPropagation()
      const additive = e.nativeEvent.shiftKey || e.nativeEvent.metaKey || e.nativeEvent.ctrlKey
      if (!selected && !additive) {
        onSelectBin(bin.id, false)
      } else if (additive) {
        onSelectBin(bin.id, true)
      }
      offsetRef.current = {
        x: e.point.x - bin.position.x,
        y: e.point.y - bin.position.y
      }
      lastSnappedRef.current = { x: bin.position.x, y: bin.position.y }
      startDrag()
      setDragging(true)
    },
    [bin.id, bin.position.x, bin.position.y, selected, onSelectBin, startDrag]
  )

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging) return
      e.stopPropagation()
      const rawX = e.point.x - offsetRef.current.x
      const rawY = e.point.y - offsetRef.current.y
      const snappedX = Math.round(rawX / baseUnit) * baseUnit
      const snappedY = Math.round(rawY / baseUnit) * baseUnit
      const dx = snappedX - lastSnappedRef.current.x
      const dy = snappedY - lastSnappedRef.current.y
      if (dx === 0 && dy === 0) return

      // Move all selected bins together
      const binsToMove = selected ? allBins.filter((b) => selectedBinIds.has(b.id)) : [bin]

      // Collision check: ensure none of the moving bins overlap non-moving bins
      const movingIds = new Set(binsToMove.map((b) => b.id))
      const staticRects = allBins
        .filter((b) => !movingIds.has(b.id))
        .map((b) => ({
          x: b.position.x,
          y: b.position.y,
          w: b.width * baseUnit,
          d: b.depth * baseUnit
        }))

      for (const b of binsToMove) {
        const candidate = {
          x: b.position.x + dx,
          y: b.position.y + dy,
          w: b.width * baseUnit,
          d: b.depth * baseUnit
        }
        if (binOverlapsAny(candidate, staticRects)) return
      }

      lastSnappedRef.current = { x: snappedX, y: snappedY }
      for (const b of binsToMove) {
        onBinMove(b.id, dx, dy)
      }
    },
    [dragging, baseUnit, bin, selected, selectedBinIds, allBins, onBinMove]
  )

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging) return
      e.stopPropagation()
      setDragging(false)
      endDrag()
    },
    [dragging, endDrag]
  )

  // ── Resize handles ──

  const handleResizeDown = useCallback(
    (e: ThreeEvent<PointerEvent>, edge: BinResizeEdge) => {
      if (e.nativeEvent.button !== 0) return
      e.stopPropagation()
      const domTarget = e.nativeEvent.target as HTMLElement | null
      domTarget?.setPointerCapture?.(e.nativeEvent.pointerId)
      startDrag()
      setResizingEdge(edge)
    },
    [startDrag]
  )

  const handleResizeMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!resizingEdge || !onBinResize) return
      e.stopPropagation()

      const px = e.point.x
      const py = e.point.y

      let newX = bin.position.x
      let newY = bin.position.y
      let newW = bin.width
      let newD = bin.depth

      if (resizingEdge === 'e') {
        newW = Math.max(1, Math.round((px - bin.position.x) / baseUnit))
      } else if (resizingEdge === 'w') {
        const snappedX = Math.round(px / baseUnit) * baseUnit
        const rightEdge = bin.position.x + widthMm
        newW = Math.max(1, Math.round((rightEdge - snappedX) / baseUnit))
        newX = rightEdge - newW * baseUnit
      } else if (resizingEdge === 'n') {
        newD = Math.max(1, Math.round((py - bin.position.y) / baseUnit))
      } else if (resizingEdge === 's') {
        const snappedY = Math.round(py / baseUnit) * baseUnit
        const topEdge = bin.position.y + depthMm
        newD = Math.max(1, Math.round((topEdge - snappedY) / baseUnit))
        newY = topEdge - newD * baseUnit
      }

      if (
        newW === bin.width &&
        newD === bin.depth &&
        newX === bin.position.x &&
        newY === bin.position.y
      )
        return

      // Collision check
      const candidate = { x: newX, y: newY, w: newW * baseUnit, d: newD * baseUnit }
      if (binOverlapsAny(candidate, otherRects)) return

      const patch: Partial<Bin> = {}
      if (newW !== bin.width) patch.width = newW
      if (newD !== bin.depth) patch.depth = newD
      if (newX !== bin.position.x || newY !== bin.position.y) patch.position = { x: newX, y: newY }
      onBinResize(bin.id, patch)
    },
    [resizingEdge, onBinResize, bin, baseUnit, widthMm, depthMm, otherRects]
  )

  const handleResizeUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!resizingEdge) return
      e.stopPropagation()
      setResizingEdge(null)
      endDrag()
    },
    [resizingEdge, endDrag]
  )

  const HANDLE_THICKNESS = 3
  const handles: Array<{
    edge: BinResizeEdge
    x: number
    y: number
    w: number
    h: number
    cursor: string
  }> =
    selected && onBinResize
      ? [
          {
            edge: 'e',
            x: bin.position.x + widthMm,
            y: cy,
            w: HANDLE_THICKNESS,
            h: depthMm,
            cursor: 'ew-resize'
          },
          {
            edge: 'w',
            x: bin.position.x,
            y: cy,
            w: HANDLE_THICKNESS,
            h: depthMm,
            cursor: 'ew-resize'
          },
          {
            edge: 'n',
            x: cx,
            y: bin.position.y + depthMm,
            w: widthMm,
            h: HANDLE_THICKNESS,
            cursor: 'ns-resize'
          },
          {
            edge: 's',
            x: cx,
            y: bin.position.y,
            w: widthMm,
            h: HANDLE_THICKNESS,
            cursor: 'ns-resize'
          }
        ]
      : []

  return (
    <>
      {/* Hit area over the bin footprint */}
      <mesh
        position={[cx, cy, Z.BIN_HIT_AREA]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => onBinHover?.(bin.id)}
        onPointerOut={() => onBinHover?.(null)}
      >
        <planeGeometry args={[widthMm, depthMm]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Resize handles on selected bin edges */}
      {handles.map((h) => (
        <mesh
          key={h.edge}
          position={[h.x, h.y, Z.BIN_RESIZE_HANDLE]}
          onPointerDown={(e) => handleResizeDown(e, h.edge)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerOver={(e) => {
            const el = (e.nativeEvent.target as HTMLElement | null)?.closest?.('div')
            if (el) el.style.cursor = h.cursor
          }}
          onPointerOut={(e) => {
            const el = (e.nativeEvent.target as HTMLElement | null)?.closest?.('div')
            if (el) el.style.cursor = ''
          }}
        >
          <planeGeometry args={[h.w, h.h]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Full-screen capture plane while dragging or resizing */}
      {(dragging || resizingEdge) && (
        <mesh
          position={[0, 0, Z.BIN_CAPTURE_PLANE]}
          onPointerMove={resizingEdge ? handleResizeMove : handlePointerMove}
          onPointerUp={resizingEdge ? handleResizeUp : handlePointerUp}
        >
          <planeGeometry args={[10000, 10000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  )
}
