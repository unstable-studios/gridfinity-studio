/**
 * Where a bin goes when it is given a new size from the sidebar or the right-click menu.
 *
 * A bin keeps its lower-left corner and grows to the right and upward. When another bin is
 * in the way there, the bin is moved to the nearest place on the grid where the new size
 * fits. Growing the other way is such a place: the bin moves left or down by what it grew. Only when nothing nearby is free is the resize refused.
 */
import { checkGroupCollision } from '@/layout-engine/collision'
import type { LayoutGroup } from '@/layout-engine/types'

export type ResizePlan =
  /** Where the bin's lower-left corner goes. `moved` when that is not where it was. */
  | { ok: true; x: number; y: number; moved: boolean }
  /** No room nearby. `blockedBy` is the bin in the way where it stands. */
  | { ok: false; blockedBy: LayoutGroup }

/**
 * `bin` at its new `width` and `height`, among `groups`. `unit` is the grid the bins are on.
 * It looks no further than the bin's own new size in any direction: a bin that had to go
 * further than that to fit would not be where the person left it in any useful sense.
 */
export function planResize(
  bin: LayoutGroup,
  width: number,
  height: number,
  groups: LayoutGroup[],
  unit: number
): ResizePlan {
  const blockerAt = (x: number, y: number): LayoutGroup | undefined => {
    const id = checkGroupCollision({ x, y, width, height }, bin.id, groups)
    return id === null ? undefined : groups.find((group) => group.id === id)
  }

  const blockedBy = blockerAt(bin.x, bin.y)
  if (!blockedBy) return { ok: true, x: bin.x, y: bin.y, moved: false }

  const reach = Math.max(1, Math.round(Math.max(width, height) / unit))
  const steps: Array<{ dx: number; dy: number; distance: number }> = []
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dy = -reach; dy <= reach; dy++) {
      if (dx !== 0 || dy !== 0) steps.push({ dx, dy, distance: dx * dx + dy * dy })
    }
  }
  // Nearest first. Among equals, along the side that grew: a bin made deeper goes up or
  // down, and one made wider (or both) goes sideways. Then left before right and up before
  // down, so the same resize always ends in the same place.
  const onlyDeeper = height > bin.height && width <= bin.width
  const acrossGrowth = (step: { dx: number; dy: number }): number =>
    Math.abs(onlyDeeper ? step.dx : step.dy)
  steps.sort(
    (a, b) =>
      a.distance - b.distance || acrossGrowth(a) - acrossGrowth(b) || a.dx - b.dx || a.dy - b.dy
  )
  for (const { dx, dy } of steps) {
    const x = bin.x + dx * unit
    const y = bin.y + dy * unit
    if (!blockerAt(x, y)) return { ok: true, x, y, moved: true }
  }
  return { ok: false, blockedBy }
}
