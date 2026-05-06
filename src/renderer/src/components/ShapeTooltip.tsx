/**
 * Hover tooltip for canvas shapes. Mousemove on the canvas container →
 * engine hit-test → floating tooltip with shape name + depth, no hover delay.
 *
 * Skips when a drawing tool is active or when the engine reports an
 * in-progress interaction (drag/resize) — the user is busy and a tooltip
 * would be noise.
 */
import { useEffect, useState } from 'react'
import { useLayoutEngineContext, useEngineState, isBinGroup } from '@/layout-engine'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { computeDefaultPocketDepth, DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'

interface HoverState {
  shapeId: string
  clientX: number
  clientY: number
}

export default function ShapeTooltip(): React.JSX.Element | null {
  const { engine, containerRef } = useLayoutEngineContext()
  const { tick } = useEngineState()
  const { activeTool } = useAppMode()
  const unitHeight = useProject(
    (s) => s.project?.gridfinity.unitHeight ?? DEFAULT_GRIDFINITY_CONFIG.unitHeight
  )
  const [hover, setHover] = useState<HoverState | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !engine) return
    // Don't attach listeners while a drawing tool is active — the user is
    // busy and the drawing overlay also captures pointer events. Stale
    // hover state is OK; the render guard below skips drawing the tooltip.
    if (activeTool && activeTool !== 'select') return

    const onMove = (e: PointerEvent): void => {
      if (engine.isInteracting()) {
        setHover(null)
        return
      }
      const rect = container.getBoundingClientRect()
      const vp = engine.getViewport()
      const worldX = (e.clientX - rect.left + vp.panX) / vp.zoom
      const worldY = (e.clientY - rect.top + vp.panY) / vp.zoom
      const hit = engine.objectAt(worldX, worldY)
      if (hit?.type === 'shape') {
        setHover({ shapeId: hit.id, clientX: e.clientX, clientY: e.clientY })
      } else {
        setHover(null)
      }
    }
    const onLeave = (): void => setHover(null)

    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerleave', onLeave)
    return () => {
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerleave', onLeave)
    }
  }, [engine, containerRef, activeTool])

  if (!hover || !engine) return null
  if (activeTool && activeTool !== 'select') return null
  // Re-read on every tick so depth/name edits surface even if the mouse
  // hasn't moved since the last engine mutation.
  void tick
  const shape = engine.getShape(hover.shapeId)
  if (!shape) return null

  const name = (shape.metadata?.name as string | undefined) ?? shape.type
  const meta = shape.metadata as { pocket?: { depth?: number | null } } | undefined
  const depthVal = meta?.pocket?.depth

  let depthLabel = '—'
  if (shape.groupId) {
    const bin = engine.getGroup(shape.groupId)
    if (bin && isBinGroup(bin)) {
      if (depthVal === null || depthVal === undefined) {
        const auto = computeDefaultPocketDepth(bin.metadata.heightUnits, unitHeight)
        depthLabel = `Auto (${auto}mm)`
      } else {
        depthLabel = `${depthVal}mm`
      }
    }
  }

  return (
    <div
      role="tooltip"
      style={{
        left: hover.clientX + 12,
        top: hover.clientY + 12
      }}
      className="fixed z-50 pointer-events-none rounded-md bg-zinc-900/95 px-2 py-1 text-xs text-zinc-100 shadow-lg ring-1 ring-zinc-700 backdrop-blur-sm"
    >
      <div className="font-medium">{name}</div>
      <div className="text-zinc-400">Depth: {depthLabel}</div>
    </div>
  )
}
