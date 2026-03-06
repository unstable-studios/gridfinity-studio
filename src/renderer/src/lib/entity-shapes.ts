/**
 * Convert entity shapes to 2D vertex arrays for pocket extrusion.
 */

import type { Entity } from '../../../shared/types/project'

const CIRCLE_SEGMENTS = 32

/**
 * Generate a 2D vertex loop for an entity's shape (in local coordinates, centered at origin).
 * Returns null for entity types that don't have a meaningful 2D outline.
 */
export function entityToVertices(entity: Entity): Float32Array | null {
  switch (entity.type) {
    case 'circle': {
      const r = entity.diameter / 2
      const verts = new Float32Array(CIRCLE_SEGMENTS * 2)
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS
        verts[i * 2] = r * Math.cos(angle)
        verts[i * 2 + 1] = r * Math.sin(angle)
      }
      return verts
    }
    case 'rectangle': {
      const hw = entity.width / 2
      const hh = entity.height / 2
      // CCW rectangle
      return new Float32Array([-hw, -hh, hw, -hh, hw, hh, -hw, hh])
    }
    case 'polygon': {
      if (entity.vertices.length < 3) return null
      const verts = new Float32Array(entity.vertices.length * 2)
      for (let i = 0; i < entity.vertices.length; i++) {
        verts[i * 2] = entity.vertices[i].x
        verts[i * 2 + 1] = entity.vertices[i].y
      }
      return verts
    }
    default:
      return null
  }
}
