/**
 * Auto-wrap: compute the minimal grid-aligned bin that contains all given entities.
 *
 * T130 implementation.
 */

import type { Entity, PolygonEntity } from '../../../shared/types/project'

export interface AutoWrapResult {
  width: number // grid units
  depth: number // grid units
  position: { x: number; y: number } // mm, top-left corner, grid-aligned
}

/** Default margin added on each side of the entity AABB before snapping to grid */
const DEFAULT_MARGIN = 1

/**
 * Compute the 2D AABB half-extents for an entity, in local space.
 * Returns { hw, hh } — half-width and half-height.
 */
function entityHalfExtents(entity: Entity): { hw: number; hh: number } {
  switch (entity.type) {
    case 'circle': {
      const r = entity.diameter / 2
      return { hw: r, hh: r }
    }
    case 'rectangle': {
      return { hw: entity.width / 2, hh: entity.height / 2 }
    }
    case 'polygon': {
      return polygonHalfExtents(entity)
    }
    // svg-region, mesh, and legacy entities: treat as zero-size point
    default:
      return { hw: 0, hh: 0 }
  }
}

function polygonHalfExtents(entity: PolygonEntity): { hw: number; hh: number } {
  if (entity.vertices.length === 0) return { hw: 0, hh: 0 }

  let minX = entity.vertices[0].x
  let maxX = entity.vertices[0].x
  let minY = entity.vertices[0].y
  let maxY = entity.vertices[0].y

  for (const v of entity.vertices) {
    if (v.x < minX) minX = v.x
    if (v.x > maxX) maxX = v.x
    if (v.y < minY) minY = v.y
    if (v.y > maxY) maxY = v.y
  }

  return {
    hw: (maxX - minX) / 2,
    hh: (maxY - minY) / 2
  }
}

/**
 * Snap a value down to the nearest multiple of `unit`.
 */
function snapFloor(value: number, unit: number): number {
  return Math.floor(value / unit) * unit
}

/**
 * Compute the minimal grid-aligned bin that contains all given entities.
 *
 * @param entities - Entities to wrap
 * @param baseUnit - Grid unit size in mm (typically 42)
 * @param margin   - Margin added on each side in mm (default: 1)
 */
export function autoWrap(
  entities: Entity[],
  baseUnit: number,
  margin: number = DEFAULT_MARGIN
): AutoWrapResult {
  if (entities.length === 0) {
    return { width: 1, depth: 1, position: { x: 0, y: 0 } }
  }

  // Compute combined AABB across all entities
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const entity of entities) {
    const cx = entity.transform.position.x
    const cy = entity.transform.position.y
    const { hw, hh } = entityHalfExtents(entity)

    if (cx - hw < minX) minX = cx - hw
    if (cy - hh < minY) minY = cy - hh
    if (cx + hw > maxX) maxX = cx + hw
    if (cy + hh > maxY) maxY = cy + hh
  }

  // Add margin on each side
  minX -= margin
  minY -= margin
  maxX += margin
  maxY += margin

  // Snap the min corner to the grid line at or before the min point
  const snappedMinX = snapFloor(minX, baseUnit)
  const snappedMinY = snapFloor(minY, baseUnit)

  // Compute span in mm and ceil to nearest grid unit
  const spanX = maxX - snappedMinX
  const spanY = maxY - snappedMinY

  const width = Math.max(1, Math.ceil(spanX / baseUnit))
  const depth = Math.max(1, Math.ceil(spanY / baseUnit))

  return {
    width,
    depth,
    position: { x: snappedMinX, y: snappedMinY }
  }
}
