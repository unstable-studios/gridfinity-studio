import { describe, it, expect } from 'vitest'
import {
  detectCollisions,
  getEntityBounds,
  type CollisionPair,
  type EntityBounds
} from '../collision'
import type {
  CircleEntity,
  RectangleEntity,
  PolygonEntity,
  Transform
} from '../../../../shared/types/project'

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeTransform(x: number, y: number): Transform {
  return {
    position: { x, y, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  }
}

function makeRect(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number
): RectangleEntity {
  return {
    id,
    name: id,
    type: 'rectangle',
    width,
    height,
    visible: true,
    locked: false,
    transform: makeTransform(cx, cy),
    properties: {}
  }
}

function makeCircle(id: string, cx: number, cy: number, diameter: number): CircleEntity {
  return {
    id,
    name: id,
    type: 'circle',
    diameter,
    visible: true,
    locked: false,
    transform: makeTransform(cx, cy),
    properties: {}
  }
}

function makePolygon(
  id: string,
  cx: number,
  cy: number,
  vertices: { x: number; y: number }[]
): PolygonEntity {
  return {
    id,
    name: id,
    type: 'polygon',
    vertices,
    visible: true,
    locked: false,
    transform: makeTransform(cx, cy),
    properties: {}
  }
}

function pairIds(pairs: CollisionPair[]): Array<[string, string]> {
  return pairs.map((p) => [p.a, p.b])
}

// ─── getEntityBounds ───────────────────────────────────────────────────────────

describe('getEntityBounds', () => {
  it('rectangle centered at origin has symmetric bounds', () => {
    const rect = makeRect('r', 0, 0, 20, 10)
    const bounds = getEntityBounds(rect) as EntityBounds
    expect(bounds.minX).toBeCloseTo(-10)
    expect(bounds.maxX).toBeCloseTo(10)
    expect(bounds.minY).toBeCloseTo(-5)
    expect(bounds.maxY).toBeCloseTo(5)
  })

  it('rectangle offset by position reflects world coordinates', () => {
    const rect = makeRect('r', 100, 50, 20, 10)
    const bounds = getEntityBounds(rect) as EntityBounds
    expect(bounds.minX).toBeCloseTo(90)
    expect(bounds.maxX).toBeCloseTo(110)
    expect(bounds.minY).toBeCloseTo(45)
    expect(bounds.maxY).toBeCloseTo(55)
  })

  it('circle produces square bounding box of side diameter', () => {
    const c = makeCircle('c', 0, 0, 30)
    const bounds = getEntityBounds(c) as EntityBounds
    expect(bounds.minX).toBeCloseTo(-15)
    expect(bounds.maxX).toBeCloseTo(15)
    expect(bounds.minY).toBeCloseTo(-15)
    expect(bounds.maxY).toBeCloseTo(15)
  })

  it('circle offset by position reflects world coordinates', () => {
    const c = makeCircle('c', 10, 20, 10)
    const bounds = getEntityBounds(c) as EntityBounds
    expect(bounds.minX).toBeCloseTo(5)
    expect(bounds.maxX).toBeCloseTo(15)
    expect(bounds.minY).toBeCloseTo(15)
    expect(bounds.maxY).toBeCloseTo(25)
  })

  it('polygon bounds encompass all world-space vertices', () => {
    // Triangle with local vertices; center at (5, 5)
    const poly = makePolygon('p', 5, 5, [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 0, y: 10 }
    ])
    const bounds = getEntityBounds(poly) as EntityBounds
    expect(bounds.minX).toBeCloseTo(-5) // 5 + (-10)
    expect(bounds.maxX).toBeCloseTo(15) // 5 + 10
    expect(bounds.minY).toBeCloseTo(-5) // 5 + (-10)
    expect(bounds.maxY).toBeCloseTo(15) // 5 + 10
  })

  it('polygon with fewer than 3 vertices returns null', () => {
    const poly = makePolygon('p', 0, 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ])
    expect(getEntityBounds(poly)).toBeNull()
  })

  it('non-geometric entity type (mesh) returns null', () => {
    const mesh = {
      id: 'm',
      name: 'm',
      type: 'mesh' as const,
      sourceFile: 'model.stl',
      visible: true,
      locked: false,
      transform: makeTransform(0, 0),
      properties: {}
    }
    expect(getEntityBounds(mesh)).toBeNull()
  })
})

// ─── detectCollisions — rectangles ────────────────────────────────────────────

describe('detectCollisions — rectangles', () => {
  it('returns empty array when entity list is empty', () => {
    expect(detectCollisions([])).toEqual([])
  })

  it('returns empty array for a single entity', () => {
    const rect = makeRect('r1', 0, 0, 10, 10)
    expect(detectCollisions([rect])).toEqual([])
  })

  it('detects two overlapping rectangles', () => {
    // r1 spans x: -5..5, r2 spans x: 3..13 → 2-unit overlap
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 8, 0, 10, 10)
    const pairs = detectCollisions([r1, r2])
    expect(pairs).toHaveLength(1)
    expect(pairIds(pairs)).toContainEqual(['r1', 'r2'])
  })

  it('does not detect non-overlapping rectangles', () => {
    // r1 spans x: -5..5, r2 spans x: 10..20 → gap of 5
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 15, 0, 10, 10)
    expect(detectCollisions([r1, r2])).toEqual([])
  })

  it('does not detect edge-touching rectangles (exactly adjacent, no overlap)', () => {
    // r1 right edge at x=5, r2 left edge at x=5 — touching but not overlapping
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 10, 0, 10, 10)
    expect(detectCollisions([r1, r2])).toEqual([])
  })

  it('detects overlap when separation is just inside the threshold', () => {
    // r1 spans x: -5..5, r2 spans x: 4..14 → 1-unit overlap
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 9, 0, 10, 10)
    const pairs = detectCollisions([r1, r2])
    expect(pairs).toHaveLength(1)
  })

  it('correctly pairs IDs: a is the entity with lower index', () => {
    const r1 = makeRect('alpha', 0, 0, 10, 10)
    const r2 = makeRect('beta', 5, 0, 10, 10)
    const pairs = detectCollisions([r1, r2])
    expect(pairs[0].a).toBe('alpha')
    expect(pairs[0].b).toBe('beta')
  })

  it('reports multiple collision pairs when three rectangles all overlap', () => {
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 5, 0, 10, 10) // overlaps r1
    const r3 = makeRect('r3', 3, 0, 10, 10) // overlaps r1 and r2
    const pairs = detectCollisions([r1, r2, r3])
    expect(pairs).toHaveLength(3)
  })

  it('reports only the colliding pair when one pair overlaps and another does not', () => {
    const r1 = makeRect('r1', 0, 0, 10, 10)
    const r2 = makeRect('r2', 8, 0, 10, 10) // overlaps r1
    const r3 = makeRect('r3', 100, 100, 10, 10) // far away
    const pairs = detectCollisions([r1, r2, r3])
    expect(pairs).toHaveLength(1)
    expect(pairIds(pairs)).toContainEqual(['r1', 'r2'])
  })
})

// ─── detectCollisions — circles ───────────────────────────────────────────────

describe('detectCollisions — circles', () => {
  it('detects two overlapping circles', () => {
    // c1 radius 5, c2 radius 5, centers 8 apart → overlap of 2
    const c1 = makeCircle('c1', 0, 0, 10)
    const c2 = makeCircle('c2', 8, 0, 10)
    const pairs = detectCollisions([c1, c2])
    expect(pairs).toHaveLength(1)
    expect(pairIds(pairs)).toContainEqual(['c1', 'c2'])
  })

  it('does not detect non-overlapping circles', () => {
    // c1 radius 5, c2 radius 5, centers 15 apart
    const c1 = makeCircle('c1', 0, 0, 10)
    const c2 = makeCircle('c2', 15, 0, 10)
    expect(detectCollisions([c1, c2])).toEqual([])
  })

  it('does not detect circles that are exactly tangent (touching at one point)', () => {
    // c1 radius 5, c2 radius 5, centers exactly 10 apart
    const c1 = makeCircle('c1', 0, 0, 10)
    const c2 = makeCircle('c2', 10, 0, 10)
    expect(detectCollisions([c1, c2])).toEqual([])
  })

  it('detects circles whose AABB overlaps but actual circles do not (diagonal near-miss)', () => {
    // Two circles of radius 5 with centers at (0,0) and (7,7)
    // AABB overlaps (both span ±5 so AABBs share the region 2..5 in each axis),
    // but distance between centers = sqrt(98) ≈ 9.9 > 10 (sum of radii)
    const c1 = makeCircle('c1', 0, 0, 10)
    const c2 = makeCircle('c2', 7, 7, 10)
    // distance = sqrt(49+49) ≈ 9.899 < 10, so they actually DO overlap
    // Use a more separated diagonal: centers at (0,0) and (8,8)
    // distance = sqrt(128) ≈ 11.31 > 10 → no collision
    const c3 = makeCircle('c3', 0, 0, 10)
    const c4 = makeCircle('c4', 8, 8, 10)
    // AABB for c3: -5..5, -5..5; c4: 3..13, 3..13 → AABBs overlap
    // Actual distance = sqrt(128) ≈ 11.31 > 10 → no circle collision
    expect(detectCollisions([c3, c4])).toEqual([])
    // But confirm (0,0)-(7,7) pair DOES collide (distance ≈ 9.9 < 10)
    expect(detectCollisions([c1, c2])).toHaveLength(1)
  })
})

// ─── detectCollisions — polygons ──────────────────────────────────────────────

describe('detectCollisions — polygons', () => {
  it('detects two overlapping polygons via AABB', () => {
    // Both unit squares centered at positions that cause AABB overlap
    const p1 = makePolygon('p1', 0, 0, [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ])
    const p2 = makePolygon('p2', 8, 0, [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ])
    // p1 world AABB: -5..5, p2 world AABB: 3..13 → overlapping
    const pairs = detectCollisions([p1, p2])
    expect(pairs).toHaveLength(1)
    expect(pairIds(pairs)).toContainEqual(['p1', 'p2'])
  })

  it('does not detect non-overlapping polygons', () => {
    const p1 = makePolygon('p1', 0, 0, [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ])
    const p2 = makePolygon('p2', 20, 0, [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ])
    // p1 world AABB: -5..5, p2 world AABB: 15..25 → no overlap
    expect(detectCollisions([p1, p2])).toEqual([])
  })

  it('skips polygon with fewer than 3 vertices (no bounds)', () => {
    const p1 = makePolygon('p1', 0, 0, [
      { x: 0, y: 0 },
      { x: 5, y: 0 }
    ])
    const r1 = makeRect('r1', 0, 0, 10, 10)
    // p1 has no valid bounds, so it cannot collide with anything
    expect(detectCollisions([p1, r1])).toEqual([])
  })
})

// ─── detectCollisions — mixed types ───────────────────────────────────────────

describe('detectCollisions — mixed entity types', () => {
  it('detects collision between a circle and a rectangle', () => {
    // Circle at (0,0) radius 5, rect at (8,0) 10×10 → AABB overlap in x: (3..5) ∩ (3..13)
    const c = makeCircle('c1', 0, 0, 10)
    const r = makeRect('r1', 8, 0, 10, 10)
    const pairs = detectCollisions([c, r])
    expect(pairs).toHaveLength(1)
    expect(pairIds(pairs)).toContainEqual(['c1', 'r1'])
  })

  it('does not detect collision between a non-overlapping circle and rectangle', () => {
    const c = makeCircle('c1', 0, 0, 10)
    const r = makeRect('r1', 20, 0, 10, 10)
    expect(detectCollisions([c, r])).toEqual([])
  })

  it('ignores non-geometric entities (mesh, svg-region) in collision checks', () => {
    const mesh = {
      id: 'm1',
      name: 'm1',
      type: 'mesh' as const,
      sourceFile: 'model.stl',
      visible: true,
      locked: false,
      transform: makeTransform(0, 0),
      properties: {}
    }
    const rect = makeRect('r1', 0, 0, 10, 10)
    // mesh has no bounds, should not appear in any collision pair
    expect(detectCollisions([mesh, rect])).toEqual([])
    expect(detectCollisions([rect, mesh])).toEqual([])
  })
})
