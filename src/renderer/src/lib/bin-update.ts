/**
 * Changing a bin's size, height or lip, from the sidebar or the right-click menu.
 */
import type { LayoutEngine } from '@/layout-engine/interface'
import { isBinGroup } from '@/layout-engine/types'
import type { BinMetadata, LayoutGroup } from '@/layout-engine/types'

/**
 * Apply `patch` to a bin. A change of width or depth resizes it on the canvas: its lower-left
 * corner stays put, so it grows to the right and upward. Returns false when there is no room
 * for the new size, and then nothing has changed.
 */
export function updateBin(
  engine: LayoutEngine,
  binId: string,
  patch: Partial<BinMetadata>,
  baseUnit: number
): boolean {
  const group = engine.getGroup(binId)
  if (!group || !isBinGroup(group)) return true

  const metadata: BinMetadata = { ...group.metadata, ...patch }
  const groupPatch: Partial<LayoutGroup> = { metadata }
  if (patch.widthUnits !== undefined || patch.depthUnits !== undefined) {
    groupPatch.width = metadata.widthUnits * baseUnit
    groupPatch.height = metadata.depthUnits * baseUnit
  }
  return engine.updateGroup(binId, groupPatch)
}
