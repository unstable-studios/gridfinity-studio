import { useEffect, useCallback, useMemo } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useSharedSelection } from '@/hooks/useSelection'
import { useSnapping } from '@/hooks/useSnapping'
import LayoutCanvas from './layout/LayoutCanvas'
import ReviewCanvas from './review/ReviewCanvas'
import HintCard from './HintCard'
import type { Entity, Bin } from '../../../shared/types/project'

export default function Viewport(): React.JSX.Element {
  const { mode } = useAppMode()
  const {
    project,
    addEntity,
    updateEntity,
    moveEntity,
    removeEntity,
    updateBin,
    removeBin,
    bakeResults
  } = useProject()
  const selection = useSharedSelection()
  const snapping = useSnapping()

  const entities = useMemo(() => project?.entities ?? [], [project?.entities])
  const bins = useMemo(() => project?.bins ?? [], [project?.bins])
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  const handlePlace = (partial: Partial<Entity> & { type: Entity['type'] }): void => {
    // Auto-associate with selected bin, or first bin
    const targetBinId =
      selection.selectionType === 'bin' && selection.selectedIds.size > 0
        ? [...selection.selectedIds][0]
        : bins[0]?.id
    const entity = addEntity(partial, targetBinId)
    selection.select(entity.id)
  }

  const handleMove = (id: string, dx: number, dy: number): void => {
    moveEntity(id, dx, dy)
  }

  /** After drag ends, reassign moved entities to whatever bin contains their center. */
  const handleMoveEnd = useCallback(
    (movedIds: Set<string>) => {
      for (const entityId of movedIds) {
        const entity = entities.find((e) => e.id === entityId)
        if (!entity) continue
        const cx = entity.transform.position.x
        const cy = entity.transform.position.y

        // Find the bin whose footprint contains the entity center
        let targetBin: Bin | undefined
        for (const bin of bins) {
          const bx = bin.position.x
          const by = bin.position.y
          const bw = bin.width * baseUnit
          const bd = bin.depth * baseUnit
          if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bd) {
            targetBin = bin
            break
          }
        }

        // Remove entity from any bin it's currently in
        for (const bin of bins) {
          if (bin.entityIds.includes(entityId)) {
            if (targetBin?.id === bin.id) {
              // Already in the right bin — no change needed
              targetBin = undefined
              break
            }
            updateBin(bin.id, { entityIds: bin.entityIds.filter((id) => id !== entityId) })
          }
        }

        // Add to the target bin (if it changed)
        if (targetBin) {
          updateBin(targetBin.id, { entityIds: [...targetBin.entityIds, entityId] })
        }
      }
    },
    [entities, bins, baseUnit, updateBin]
  )

  const handleResize = (id: string, patch: Partial<Entity>): void => {
    updateEntity(id, patch)
  }

  const handleBinMove = (id: string, position: { x: number; y: number }): void => {
    updateBin(id, { position })
  }

  const snapFn = (pos: { x: number; y: number }): { x: number; y: number } => {
    const others = entities.filter((e) => !selection.selectedIds.has(e.id))
    return snapping.snap(pos, baseUnit, others)
  }

  const handleDelete = useCallback(() => {
    if (selection.selectedIds.size === 0) return
    for (const id of selection.selectedIds) {
      if (selection.selectionType === 'entity') {
        removeEntity(id)
      } else {
        removeBin(id)
      }
    }
    selection.clearSelection()
  }, [selection, removeEntity, removeBin])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        e.preventDefault()
        handleDelete()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleDelete])

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-linear-to-b from-zinc-100/50 via-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-900 dark:to-zinc-900/70">
      <div className={mode === 'layout' ? 'h-full' : 'hidden'}>
        <LayoutCanvas
          entities={entities}
          bins={bins}
          selectedIds={selection.selectedIds}
          selectionType={selection.selectionType}
          baseUnit={baseUnit}
          gridfinityConfig={project?.gridfinity}
          onPlace={handlePlace}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          onResize={handleResize}
          onBinMove={handleBinMove}
          onSelect={selection.select}
          onSelectBin={selection.selectBin}
          onClearSelection={selection.clearSelection}
          snap={snapFn}
        />
      </div>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} bins={bins} baseUnit={baseUnit} />
      </div>
      <HintCard />
    </div>
  )
}
