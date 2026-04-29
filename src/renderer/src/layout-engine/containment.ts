/**
 * Engine-agnostic bin containment utilities.
 *
 * Determines which bin (LayoutGroup with BinMetadata) contains a given
 * world-space point using the lower-left corner coordinate convention.
 */

import type { LayoutGroup, BinMetadata } from './types'
import { isBinGroup } from './types'

/**
 * Find the bin group whose AABB contains the given world-space point.
 *
 * Uses the lower-left corner convention:
 * - group.x = left edge (smallest x)
 * - group.y = bottom edge (largest y in screen coords)
 * - Bin extends rightward by width (+x) and upward by height (-y)
 *
 * If the point is inside multiple bins (shouldn't happen with collision
 * detection, but defensive), returns the bin whose center is closest
 * to the point.
 */
export function findContainingBinGroup(
  groups: LayoutGroup[],
  worldX: number,
  worldY: number
): (LayoutGroup & { metadata: BinMetadata }) | null {
  let best: (LayoutGroup & { metadata: BinMetadata }) | null = null
  let bestDist = Infinity

  for (const group of groups) {
    if (!isBinGroup(group)) continue
    if (
      worldX >= group.x &&
      worldX <= group.x + group.width &&
      worldY <= group.y &&
      worldY >= group.y - group.height
    ) {
      // Tie-break by distance to bin center
      const cx = group.x + group.width / 2
      const cy = group.y - group.height / 2
      const dx = worldX - cx
      const dy = worldY - cy
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        best = group
      }
    }
  }

  return best
}
