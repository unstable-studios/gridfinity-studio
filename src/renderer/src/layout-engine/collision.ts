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
  if (aRight <= bLeft || bRight <= aLeft) return false
  if (aBottom <= bTop || bBottom <= aTop) return false
  return true
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
