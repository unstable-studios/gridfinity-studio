/**
 * Shared entity geometry utilities.
 * Single source of truth for center, bounds, and half-extent computations.
 */

import type { Entity, Vertex2D } from '../types/project'

export interface EntityBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface EntityHalfExtents {
  hw: number
  hh: number
}

/**
 * Return the visual center of an entity.
 * After polygon normalization, this is always transform.position for all types.
 */
export function entityCenter(entity: Entity): { x: number; y: number } {
  return { x: entity.transform.position.x, y: entity.transform.position.y }
}

/**
 * Compute the axis-aligned bounding box of an entity in world-space.
 */
export function entityBounds(entity: Entity): EntityBounds | null {
  const { x, y } = entity.transform.position
  switch (entity.type) {
    case 'circle': {
      const r = entity.diameter / 2
      return { minX: x - r, maxX: x + r, minY: y - r, maxY: y + r }
    }
    case 'rectangle': {
      const hw = entity.width / 2
      const hh = entity.height / 2
      return { minX: x - hw, maxX: x + hw, minY: y - hh, maxY: y + hh }
    }
    case 'polygon': {
      if (entity.vertices.length < 3) return null
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const v of entity.vertices) {
        const vx = x + v.x
        const vy = y + v.y
        if (vx < minX) minX = vx
        if (vx > maxX) maxX = vx
        if (vy < minY) minY = vy
        if (vy > maxY) maxY = vy
      }
      return { minX, maxX, minY, maxY }
    }
    default:
      return null
  }
}

/**
 * Compute half-extents (half-width, half-height) of an entity.
 */
export function entityHalfExtents(entity: Entity): EntityHalfExtents | null {
  switch (entity.type) {
    case 'circle': {
      const r = entity.diameter / 2
      return { hw: r, hh: r }
    }
    case 'rectangle':
      return { hw: entity.width / 2, hh: entity.height / 2 }
    case 'polygon': {
      if (entity.vertices.length < 3) return null
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const v of entity.vertices) {
        if (v.x < minX) minX = v.x
        if (v.x > maxX) maxX = v.x
        if (v.y < minY) minY = v.y
        if (v.y > maxY) maxY = v.y
      }
      return { hw: (maxX - minX) / 2, hh: (maxY - minY) / 2 }
    }
    default:
      return null
  }
}

/**
 * Normalize polygon vertices from world-space to local-space (centroid-relative).
 * Returns the centroid position and the offset vertices.
 * Idempotent: if vertices are already centroid-relative, centroid is (0,0) and no change occurs.
 */
export function normalizePolygonVertices(vertices: Vertex2D[]): {
  centroid: { x: number; y: number }
  localVertices: Vertex2D[]
} {
  if (vertices.length < 3) {
    return { centroid: { x: 0, y: 0 }, localVertices: [...vertices] }
  }
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length
  const localVertices = vertices.map((v) => ({ x: v.x - cx, y: v.y - cy }))
  return { centroid: { x: cx, y: cy }, localVertices }
}

/**
 * Check if two AABBs overlap.
 */
export function boundsOverlap(a: EntityBounds, b: EntityBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}
