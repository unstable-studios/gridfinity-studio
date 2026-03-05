import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useSharedSelection } from '@/hooks/useSelection'
import { useSnapping } from '@/hooks/useSnapping'
import LayoutCanvas from './layout/LayoutCanvas'
import ReviewCanvas from './review/ReviewCanvas'
import type { Entity } from '../../../shared/types/project'

export default function Viewport(): React.JSX.Element {
  const { mode } = useAppMode()
  const { project, addEntity, updateEntity, bakeResult } = useProject()
  const selection = useSharedSelection()
  const snapping = useSnapping()

  const entities = project?.entities ?? []
  const baseUnit = project?.gridfinity.baseUnit ?? 42
  const binWidthUnits = project?.bins[0]?.width ?? 1
  const binDepthUnits = project?.bins[0]?.depth ?? 1

  const handlePlace = (partial: Partial<Entity> & { type: Entity['type'] }): void => {
    const entity = addEntity(partial)
    selection.select(entity.id)
  }

  const handleMove = (id: string, dx: number, dy: number): void => {
    const entity = entities.find((e) => e.id === id)
    if (!entity) return
    updateEntity(id, {
      transform: {
        ...entity.transform,
        position: {
          x: entity.transform.position.x + dx,
          y: entity.transform.position.y + dy,
          z: entity.transform.position.z
        }
      }
    })
  }

  const handleResize = (id: string, patch: Partial<Entity>): void => {
    updateEntity(id, patch)
  }

  const snapFn = (pos: { x: number; y: number }): { x: number; y: number } => {
    return snapping.snap(pos, baseUnit, entities)
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-linear-to-b from-zinc-100/50 via-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-900 dark:to-zinc-900/70">
      {mode === 'layout' ? (
        <LayoutCanvas
          entities={entities}
          selectedIds={selection.selectedIds}
          baseUnit={baseUnit}
          binWidthUnits={binWidthUnits}
          binDepthUnits={binDepthUnits}
          onPlace={handlePlace}
          onMove={handleMove}
          onResize={handleResize}
          onSelect={selection.select}
          onClearSelection={selection.clearSelection}
          snap={snapFn}
        />
      ) : (
        <ReviewCanvas bakedMesh={bakeResult?.mesh ?? null} auxMeshes={bakeResult?.auxMeshes} />
      )}
    </div>
  )
}
