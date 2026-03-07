/**
 * 2D footprint collision detection for entities.
 *
 * Broad phase: axis-aligned bounding box (AABB) overlap.
 * Narrow phase circle-circle: exact distance vs sum of radii.
 * All other pairs: AABB result is the final answer (good enough for v1).
 */

import type { Entity, CircleEntity } from '../../../shared/types/project'
import {
  entityBounds as sharedEntityBounds,
  type EntityBounds
} from '../../../shared/geometry/entity-geometry'

export type { EntityBounds }

export interface CollisionPair {
  a: string
  b: string
}

/**
 * Compute the axis-aligned bounding box for an entity in world coordinates.
 * Delegates to shared geometry utility.
 */
export function getEntityBounds(entity: Entity): EntityBounds | null {
  return sharedEntityBounds(entity)
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

/**
 * Check all bins for pairwise overlap. Returns true if any two bins overlap.
 */
export function hasBinOverlaps(
  bins: Array<{ x: number; y: number; w: number; d: number }>
): boolean {
  for (let i = 0; i < bins.length; i++) {
    for (let j = i + 1; j < bins.length; j++) {
      const a = bins[i]
      const b = bins[j]
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y) {
        return true
      }
    }
  }
  return false
}
