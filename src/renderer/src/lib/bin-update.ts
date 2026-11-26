/**
 * Changing a bin's size, height or lip, from the sidebar or the right-click menu.
 */
import type { LayoutEngine } from '@/layout-engine/interface'
import { isBinGroup } from '@/layout-engine/types'
import type { BinMetadata, LayoutGroup } from '@/layout-engine/types'
import { storedName } from './item-name'
import { notifyBinMoved, notifyResizeBlocked } from './project-notices'
import { planResize } from './resize-plan'

/**
 * Apply `patch` to a bin, and say so if it had to move or could not be done.
 *
 * A change of width or depth resizes the bin on the canvas. Its lower-left corner stays
 * put, so it grows to the right and upward, unless another bin is in the way there: then it
 * goes to the nearest place the new size fits (see `planResize`), with its pockets, and a
 * notice says it moved. With no room nearby nothing changes, and a notice names the bin in
 * the way. Either way it is one change, so one step to undo.
 */
export function updateBin(
  engine: LayoutEngine,
  binId: string,
  patch: Partial<BinMetadata>,
  baseUnit: number
): void {
  const group = engine.getGroup(binId)
  if (!group || !isBinGroup(group)) return

  const metadata: BinMetadata = { ...group.metadata, ...patch }
  const groupPatch: Partial<LayoutGroup> = { metadata }
  let moved = false
  if (patch.widthUnits !== undefined || patch.depthUnits !== undefined) {
    const width = metadata.widthUnits * baseUnit
    const height = metadata.depthUnits * baseUnit
    const plan = planResize(group, width, height, engine.getAllGroups(), baseUnit)
    if (!plan.ok) {
      notifyResizeBlocked(storedName(plan.blockedBy.metadata) ?? 'Another bin')
      return
    }
    Object.assign(groupPatch, { width, height })
    if (plan.moved) Object.assign(groupPatch, { x: plan.x, y: plan.y })
    moved = plan.moved
  }
  // The plan was made with the engine's own test for bins overlapping, so this goes through.
  if (engine.updateGroup(binId, groupPatch) && moved) {
    notifyBinMoved(storedName(metadata) ?? 'The bin')
  }
}
