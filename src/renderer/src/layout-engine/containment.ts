/**
 * Engine-agnostic bin containment utilities.
 *
 * Determines which bin (LayoutGroup with BinMetadata) contains a given
 * world-space point using the lower-left corner coordinate convention.
 */

import type { LayoutGroup, LayoutShape, BinMetadata } from './types'
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

/** World-space AABB in screen-y-down coords (minY = top, maxY = bottom). */
export interface ShapeAABB {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Find the best bin for a newly drawn shape, given its AABB.
 *
 * Centroid-only matching (findContainingBinGroup) misses cases where the
 * user clearly draws "on top of" a bin but the centroid lands a hair past
 * an edge — e.g. a rect that mostly covers the bin but extends slightly
 * outside, or a circle whose first click started just outside the bin.
 *
 * Resolution:
 * 1. Compute overlap area between the shape AABB and each bin AABB.
 * 2. Drop bins with zero overlap.
 * 3. Prefer the bin whose AABB contains the shape centroid (matches the
 *    legacy strict-containment behavior for clear cases).
 * 4. Otherwise return the bin with the largest overlap area.
 */
export function findBestBinForShape(
  groups: LayoutGroup[],
  shape: ShapeAABB
): (LayoutGroup & { metadata: BinMetadata }) | null {
  const cx = (shape.minX + shape.maxX) / 2
  const cy = (shape.minY + shape.maxY) / 2

  let bestByOverlap: { bin: LayoutGroup & { metadata: BinMetadata }; area: number } | null = null
  let bestByCentroid: (LayoutGroup & { metadata: BinMetadata }) | null = null
  let bestCentroidDist = Infinity

  for (const group of groups) {
    if (!isBinGroup(group)) continue

    const binMinX = group.x
    const binMaxX = group.x + group.width
    const binMinY = group.y - group.height
    const binMaxY = group.y

    const ox = Math.max(0, Math.min(shape.maxX, binMaxX) - Math.max(shape.minX, binMinX))
    const oy = Math.max(0, Math.min(shape.maxY, binMaxY) - Math.max(shape.minY, binMinY))
    const area = ox * oy
    if (area <= 0) continue

    if (!bestByOverlap || area > bestByOverlap.area) {
      bestByOverlap = { bin: group, area }
    }

    if (cx >= binMinX && cx <= binMaxX && cy >= binMinY && cy <= binMaxY) {
      const bcx = (binMinX + binMaxX) / 2
      const bcy = (binMinY + binMaxY) / 2
      const dx = cx - bcx
      const dy = cy - bcy
      const dist = dx * dx + dy * dy
      if (dist < bestCentroidDist) {
        bestCentroidDist = dist
        bestByCentroid = group
      }
    }
  }

  return bestByCentroid ?? bestByOverlap?.bin ?? null
}

/**
 * Find children whose world centroid lies outside the bin's AABB. Used after
 * a bin resize to evict shapes that no longer fit so they remain selectable
 * (and don't bake pockets that extend past the bin's walls).
 *
 * Children store coords relative to the parent's centroid, so the world
 * centroid is `(bin.x + bin.width/2 + shape.x, bin.y - bin.height/2 + shape.y)`.
 *
 * Edge inclusivity: a child centroid sitting exactly on the bin edge counts
 * as inside (not evicted) — matches `findContainingBinGroup`'s convention.
 */
export function findChildrenOutsideBin(bin: LayoutGroup, children: LayoutShape[]): string[] {
  const minX = bin.x
  const maxX = bin.x + bin.width
  const minY = bin.y - bin.height
  const maxY = bin.y
  const cxBin = bin.x + bin.width / 2
  const cyBin = bin.y - bin.height / 2

  const out: string[] = []
  for (const child of children) {
    const cx = cxBin + child.x
    const cy = cyBin + child.y
    if (cx < minX || cx > maxX || cy < minY || cy > maxY) {
      out.push(child.id)
    }
  }
  return out
}
