/**
 * Snap target resolution for the 2D sketch viewport.
 *
 * Finds nearby snap candidates (grid intersections, entity centers,
 * entity edges) and returns the closest match within a threshold.
 */

import type { Entity, RectangleEntity, CircleEntity } from '../../../shared/types/project'
import { entityCenter } from '../../../shared/geometry/entity-geometry'

// ─── Types ────────────────────────────────────────────────────────

export interface SnapTarget {
  point: { x: number; y: number }
  type: 'grid' | 'entity-edge' | 'entity-center' | 'intersection'
}

interface Cursor {
  x: number
  y: number
}

// ─── Helpers ──────────────────────────────────────────────────────

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function roundToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

// ─── Grid snap ────────────────────────────────────────────────────

function gridSnapTarget(cursor: Cursor, gridSize: number): SnapTarget {
  return {
    point: {
      x: roundToGrid(cursor.x, gridSize),
      y: roundToGrid(cursor.y, gridSize)
    },
    type: 'grid'
  }
}

// ─── Entity center snap ──────────────────────────────────────────

function entityCenterTargets(entities: Entity[]): SnapTarget[] {
  return entities.map((e) => ({
    point: entityCenter(e),
    type: 'entity-center' as const
  }))
}

// ─── Entity edge snap ─────────────────────────────────────────────

function rectangleEdgeMidpoints(entity: RectangleEntity): SnapTarget[] {
  const { x, y } = entity.transform.position
  const w = entity.width
  const h = entity.height
  const hw = w / 2
  const hh = h / 2

  return [
    { point: { x: x - hw, y }, type: 'entity-edge' },
    { point: { x: x + hw, y }, type: 'entity-edge' },
    { point: { x, y: y - hh }, type: 'entity-edge' },
    { point: { x, y: y + hh }, type: 'entity-edge' }
  ]
}

function circleCardinalPoints(entity: CircleEntity): SnapTarget[] {
  const { x, y } = entity.transform.position
  const r = entity.diameter / 2

  return [
    { point: { x: x - r, y }, type: 'entity-edge' },
    { point: { x: x + r, y }, type: 'entity-edge' },
    { point: { x, y: y - r }, type: 'entity-edge' },
    { point: { x, y: y + r }, type: 'entity-edge' }
  ]
}

function entityEdgeTargets(entities: Entity[]): SnapTarget[] {
  const targets: SnapTarget[] = []

  for (const entity of entities) {
    if (entity.type === 'rectangle') {
      targets.push(...rectangleEdgeMidpoints(entity))
    } else if (entity.type === 'circle') {
      targets.push(...circleCardinalPoints(entity))
    }
  }

  return targets
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Resolve all snap targets near the cursor, sorted by distance and
 * filtered by the given threshold (in world units).
 */
export function resolveSnapTargets(
  cursor: Cursor,
  gridSize: number,
  entities: Entity[],
  threshold: number
): SnapTarget[] {
  const candidates: SnapTarget[] = [
    gridSnapTarget(cursor, gridSize),
    ...entityCenterTargets(entities),
    ...entityEdgeTargets(entities)
  ]

  return candidates
    .filter((t) => distance(cursor, t.point) <= threshold)
    .sort((a, b) => distance(cursor, a.point) - distance(cursor, b.point))
}

/**
 * Return the position of the nearest snap target, or null if the
 * target list is empty.
 */
export function snapToNearest(
  _cursor: Cursor,
  targets: SnapTarget[]
): { x: number; y: number } | null {
  if (targets.length === 0) return null
  return { x: targets[0].point.x, y: targets[0].point.y }
}
