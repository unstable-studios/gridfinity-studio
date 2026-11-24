import type { LayoutGroup } from './types'

/**
 * AABB (axis-aligned bounding box) for a group in lower-left corner convention.
 *
 * x, y = lower-left corner (smallest x, largest y in screen coords).
 * The box extends rightward (+x) by `width` and upward (−y) by `height`.
 */
interface AABB {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Boxes that overlap by less than this only touch, in mm. A position read back from the canvas
 * can differ from the stored one in its last digit.
 */
const TOUCH_TOLERANCE = 1e-6

/**
 * Check whether two AABBs overlap. Uses the lower-left corner convention:
 * - left edge = x
 * - right edge = x + width
 * - top edge = y - height (smaller y = higher on screen)
 * - bottom edge = y
 */
function aabbOverlap(a: AABB, b: AABB): boolean {
  const aLeft = a.x
  const aRight = a.x + a.width
  const aTop = a.y - a.height
  const aBottom = a.y

  const bLeft = b.x
  const bRight = b.x + b.width
  const bTop = b.y - b.height
  const bBottom = b.y

  // No overlap if separated on any axis
  if (aRight <= bLeft + TOUCH_TOLERANCE || bRight <= aLeft + TOUCH_TOLERANCE) return false
  if (aBottom <= bTop + TOUCH_TOLERANCE || bBottom <= aTop + TOUCH_TOLERANCE) return false
  return true
}

/** Whether `inner` lies inside `outer`, edges included. */
function aabbWithin(inner: AABB, outer: AABB): boolean {
  return (
    inner.x >= outer.x - TOUCH_TOLERANCE &&
    inner.x + inner.width <= outer.x + outer.width + TOUCH_TOLERANCE &&
    inner.y <= outer.y + TOUCH_TOLERANCE &&
    inner.y - inner.height >= outer.y - outer.height - TOUCH_TOLERANCE
  )
}

/**
 * Check if a group (by proposed bounds) collides with any other group.
 *
 * @param proposed - The proposed AABB for the group being moved/resized
 * @param groupId - The ID of the group being checked (excluded from others)
 * @param allGroups - All groups in the engine
 * @returns The ID of the first colliding group, or null if no collision
 */
export function checkGroupCollision(
  proposed: AABB,
  groupId: string,
  allGroups: LayoutGroup[],
  excludeIds?: Set<string>
): string | null {
  for (const other of allGroups) {
    if (other.id === groupId) continue
    if (excludeIds?.has(other.id)) continue
    if (aabbOverlap(proposed, other)) return other.id
  }
  return null
}

/**
 * Whether changing a group's bounds from `current` to `proposed` would put it on top of
 * another group. A group that is somehow on top of another already may still shrink within
 * its own bounds, so it can be pulled back off.
 */
export function wouldOverlapAnotherGroup(
  current: AABB,
  proposed: AABB,
  groupId: string,
  allGroups: LayoutGroup[]
): boolean {
  const shrinks = aabbWithin(proposed, current)
  return allGroups.some(
    (other) =>
      other.id !== groupId &&
      aabbOverlap(proposed, other) &&
      !(shrinks && aabbOverlap(current, other))
  )
}
