/**
 * 2D footprint collision detection for entities.
 *
 * Broad phase: axis-aligned bounding box (AABB) overlap.
 * Narrow phase circle-circle: exact distance vs sum of radii.
 * All other pairs: AABB result is the final answer (good enough for v1).
 */

import type { Entity, CircleEntity } from '../../../shared/types/project'

export interface CollisionPair {
  a: string
  b: string
}

export interface EntityBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Compute the axis-aligned bounding box for an entity in world coordinates.
 * For circles, polygon vertices, and rectangles, bounds are derived from
 * the entity's geometry, then offset by transform.position (x, y).
 *
 * Returns null for entity types that have no meaningful 2D footprint.
 */
export function getEntityBounds(entity: Entity): EntityBounds | null {
  const cx = entity.transform.position.x
  const cy = entity.transform.position.y

  switch (entity.type) {
    case 'circle': {
      const r = entity.diameter / 2
      return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r }
    }
    case 'rectangle': {
      const hw = entity.width / 2
      const hh = entity.height / 2
      return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh }
    }
    case 'polygon': {
      if (entity.vertices.length < 3) return null
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const v of entity.vertices) {
        const wx = cx + v.x
        const wy = cy + v.y
        if (wx < minX) minX = wx
        if (wy < minY) minY = wy
        if (wx > maxX) maxX = wx
        if (wy > maxY) maxY = wy
      }
      return { minX, minY, maxX, maxY }
    }
    default:
      return null
  }
}

function aabbOverlaps(a: EntityBounds, b: EntityBounds): boolean {
  // Strict less-than: touching edges (a.maxX === b.minX) is NOT an overlap
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

function circleCircleOverlaps(a: CircleEntity, b: CircleEntity): boolean {
  const dx = a.transform.position.x - b.transform.position.x
  const dy = a.transform.position.y - b.transform.position.y
  const distSq = dx * dx + dy * dy
  const sumR = a.diameter / 2 + b.diameter / 2
  return distSq < sumR * sumR
}

/**
 * Detect all overlapping entity pairs in the given array.
 *
 * Uses AABB broad phase for all pairs, then applies exact circle-circle
 * narrow phase when both entities are circles.
 *
 * @returns Array of { a, b } pairs (entity IDs) that overlap.
 */
export function detectCollisions(entities: Entity[]): CollisionPair[] {
  const pairs: CollisionPair[] = []

  for (let i = 0; i < entities.length; i++) {
    const ea = entities[i]
    const boundsA = getEntityBounds(ea)
    if (boundsA === null) continue

    for (let j = i + 1; j < entities.length; j++) {
      const eb = entities[j]
      const boundsB = getEntityBounds(eb)
      if (boundsB === null) continue

      // Broad phase: AABB
      if (!aabbOverlaps(boundsA, boundsB)) continue

      // Narrow phase: exact circle-circle
      if (ea.type === 'circle' && eb.type === 'circle') {
        if (!circleCircleOverlaps(ea, eb)) continue
      }

      pairs.push({ a: ea.id, b: eb.id })
    }
  }

  return pairs
}

/**
 * Check if a bin rectangle would overlap any bins in the given array.
 * All coordinates are in mm. Each bin is an AABB defined by position (top-left) + size.
 */
export function binOverlapsAny(
  candidate: { x: number; y: number; w: number; d: number },
  others: Array<{ x: number; y: number; w: number; d: number }>
): boolean {
  for (const o of others) {
    if (
      candidate.x < o.x + o.w &&
      candidate.x + candidate.w > o.x &&
      candidate.y < o.y + o.d &&
      candidate.y + candidate.d > o.y
    ) {
      return true
    }
  }
  return false
}

/**
 * Find the first non-overlapping grid-aligned position for a bin,
 * scanning right then wrapping down.
 */
export function findNonOverlappingPosition(
  width: number,
  depth: number,
  baseUnit: number,
  existingBins: Array<{ x: number; y: number; w: number; d: number }>,
  startX = 0,
  startY = 0
): { x: number; y: number } {
  let posX = startX
  let posY = startY
  let attempts = 0
  const maxAttempts = 200

  while (attempts < maxAttempts) {
    const candidate = { x: posX, y: posY, w: width, d: depth }
    if (!binOverlapsAny(candidate, existingBins)) {
      return { x: posX, y: posY }
    }
    posX += baseUnit
    if (posX > baseUnit * 10) {
      posX = 0
      posY += baseUnit
    }
    attempts++
  }

  // Fallback: place far away
  return { x: posX, y: posY }
}
