import { useEffect, useCallback } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useSharedSelection } from '@/hooks/useSelection'
import { useSnapping } from '@/hooks/useSnapping'
import LayoutCanvas from './layout/LayoutCanvas'
import ReviewCanvas from './review/ReviewCanvas'
import type { Entity } from '../../../shared/types/project'

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
    bakeResult
  } = useProject()
  const selection = useSharedSelection()
  const snapping = useSnapping()

  const entities = project?.entities ?? []
  const bins = project?.bins ?? []
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  const handlePlace = (partial: Partial<Entity> & { type: Entity['type'] }): void => {
    const entity = addEntity(partial)
    selection.select(entity.id)
  }

  const handleMove = (id: string, dx: number, dy: number): void => {
    moveEntity(id, dx, dy)
  }

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
      {mode === 'layout' ? (
        <LayoutCanvas
          entities={entities}
          bins={bins}
          selectedIds={selection.selectedIds}
          selectionType={selection.selectionType}
          baseUnit={baseUnit}
          onPlace={handlePlace}
          onMove={handleMove}
          onResize={handleResize}
          onBinMove={handleBinMove}
          onSelect={selection.select}
          onSelectBin={selection.selectBin}
          onClearSelection={selection.clearSelection}
          snap={snapFn}
        />
      ) : (
        <ReviewCanvas bakedMesh={bakeResult?.mesh ?? null} auxMeshes={bakeResult?.auxMeshes} />
      )}
    </div>
  )
}
