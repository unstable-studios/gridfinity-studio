/**
 * Where a bin goes when it is given a new size from the sidebar or the right-click menu.
 *
 * A bin keeps its lower-left corner and grows to the right and upward. When another bin is
 * in the way there, it grows the other way if that is free: it moves left by what it grew in
 * width, down by what it grew in depth, so it still covers where it was. Failing that it
 * goes to the nearest free place on its grid. Only when nothing nearby is free is the
 * resize refused.
 */
import { checkGroupCollision, wouldOverlapAnotherGroup } from '@/layout-engine/collision'
import type { LayoutGroup } from '@/layout-engine/types'

export type ResizePlan =
  /** Where the bin's lower-left corner goes. `moved` when that is not where it was. */
  | { ok: true; x: number; y: number; moved: boolean }
  /** No room nearby. `blockedBy` is the bin in the way where it stands. */
  | { ok: false; blockedBy: LayoutGroup }

/**
 * `bin` at its new `width` and `height`, among `groups`. `unit` is the grid the bins are on:
 * places are whole units from where the bin is, so a bin that is off the grid stays as far
 * off it. The search for a free place goes no further than the bin's own new width sideways
 * and its own new depth up or down.
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

  // Where it is, by the engine's own rule: a bin that is somehow on another already may
  // still shrink where it stands, so it can be pulled back off.
  if (!wouldOverlapAnotherGroup(bin, { x: bin.x, y: bin.y, width, height }, bin.id, groups)) {
    return { ok: true, x: bin.x, y: bin.y, moved: false }
  }
  const blockedBy = blockerAt(bin.x, bin.y)
  // Not reachable: the rule above only fails when something is in the way.
  if (!blockedBy) return { ok: true, x: bin.x, y: bin.y, moved: false }

  // Growing the other way comes first: the bin still covers where it was. Left by up to
  // what it grew in width, down by up to what it grew in depth, or both, moving as little
  // as it takes. This is tried before nearer places that would take it off its own spot.
  const stepsWide = Math.max(0, Math.round((width - bin.width) / unit))
  const stepsDeep = Math.max(0, Math.round((height - bin.height) / unit))
  const onlyDeeper = stepsDeep > 0 && stepsWide === 0
  const otherWay: Array<{ left: number; down: number }> = []
  for (let left = 0; left <= stepsWide; left++) {
    for (let down = 0; down <= stepsDeep; down++) {
      if (left > 0 || down > 0) otherWay.push({ left, down })
    }
  }
  // One direction before both, the shorter move first. A wider bin tries left before down.
  otherWay.sort(
    (a, b) =>
      Number(a.left > 0 && a.down > 0) - Number(b.left > 0 && b.down > 0) ||
      a.left + a.down - (b.left + b.down) ||
      (onlyDeeper ? a.left - b.left : a.down - b.down)
  )
  for (const { left, down } of otherWay) {
    const x = bin.x - left * unit
    const y = bin.y + down * unit
    if (!blockerAt(x, y)) return { ok: true, x, y, moved: true }
  }

  // Otherwise the nearest free place, no further than the bin's own new size each way.
  const reachX = Math.max(1, Math.round(width / unit))
  const reachY = Math.max(1, Math.round(height / unit))
  const steps: Array<{ dx: number; dy: number; distance: number }> = []
  for (let dx = -reachX; dx <= reachX; dx++) {
    for (let dy = -reachY; dy <= reachY; dy++) {
      if (dx !== 0 || dy !== 0) steps.push({ dx, dy, distance: dx * dx + dy * dy })
    }
  }
  // Nearest first. Among equals, along the side that grew: a bin made deeper goes up or
  // down, and one made wider (or both) goes sideways. Then left before right and up before
  // down, so the same resize always ends in the same place.
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
