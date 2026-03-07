import { describe, it, expect } from 'vitest'
import {
  entityCenter,
  entityBounds,
  entityHalfExtents,
  normalizePolygonVertices,
  boundsOverlap
} from '../entity-geometry'
import type { CircleEntity, RectangleEntity, PolygonEntity } from '../../types/project'

// ── Test fixtures ──

function makeCircle(x: number, y: number, diameter: number): CircleEntity {
  return {
    id: 'c1',
    name: 'Circle',
    type: 'circle',
    diameter,
    transform: {
      position: { x, y, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    visible: true,
    locked: false,
    properties: {}
  }
}

function makeRect(x: number, y: number, width: number, height: number): RectangleEntity {
  return {
    id: 'r1',
    name: 'Rect',
    type: 'rectangle',
    width,
    height,
    transform: {
      position: { x, y, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    visible: true,
    locked: false,
    properties: {}
  }
}

function makePoly(x: number, y: number, vertices: Array<{ x: number; y: number }>): PolygonEntity {
  return {
    id: 'p1',
    name: 'Poly',
    type: 'polygon',
    vertices,
    transform: {
      position: { x, y, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    visible: true,
    locked: false,
    properties: {}
  }
}

// ── entityCenter ──

describe('entityCenter', () => {
  it('returns transform.position for circle', () => {
    const c = makeCircle(10, 20, 30)
    expect(entityCenter(c)).toEqual({ x: 10, y: 20 })
  })

  it('returns transform.position for rectangle', () => {
    const r = makeRect(5, 15, 40, 60)
    expect(entityCenter(r)).toEqual({ x: 5, y: 15 })
  })

  it('returns transform.position for polygon with local-space vertices', () => {
    // Vertices are relative to transform.position (already normalized)
    const p = makePoly(50, 50, [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 0, y: 10 }
    ])
    expect(entityCenter(p)).toEqual({ x: 50, y: 50 })
  })

  it('returns transform.position for degenerate polygon', () => {
    const p = makePoly(5, 5, [{ x: 0, y: 0 }])
    expect(entityCenter(p)).toEqual({ x: 5, y: 5 })
  })
})

// ── entityBounds ──

describe('entityBounds', () => {
  it('computes circle bounds as position ± radius', () => {
    const c = makeCircle(10, 20, 30)
    expect(entityBounds(c)).toEqual({ minX: -5, maxX: 25, minY: 5, maxY: 35 })
  })

  it('computes rectangle bounds as position ± half-extents', () => {
    const r = makeRect(0, 0, 20, 10)
    expect(entityBounds(r)).toEqual({ minX: -10, maxX: 10, minY: -5, maxY: 5 })
  })

  it('computes polygon bounds from vertices offset by position', () => {
    const p = makePoly(100, 200, [
      { x: -5, y: -5 },
      { x: 10, y: -5 },
      { x: 10, y: 5 },
      { x: -5, y: 5 }
    ])
    expect(entityBounds(p)).toEqual({ minX: 95, maxX: 110, minY: 195, maxY: 205 })
  })

  it('returns null for degenerate polygon (<3 vertices)', () => {
    const p = makePoly(0, 0, [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ])
    expect(entityBounds(p)).toBeNull()
  })

  it('computes bounds for entity at non-origin position', () => {
    const c = makeCircle(-50, 30, 10)
    expect(entityBounds(c)).toEqual({ minX: -55, maxX: -45, minY: 25, maxY: 35 })
  })
})

// ── entityHalfExtents ──

describe('entityHalfExtents', () => {
  it('returns radius for circle', () => {
    const c = makeCircle(0, 0, 20)
    expect(entityHalfExtents(c)).toEqual({ hw: 10, hh: 10 })
  })

  it('returns half width/height for rectangle', () => {
    const r = makeRect(0, 0, 30, 50)
    expect(entityHalfExtents(r)).toEqual({ hw: 15, hh: 25 })
  })

  it('returns vertex bounding box half-extents for polygon', () => {
    const p = makePoly(0, 0, [
      { x: -10, y: -5 },
      { x: 10, y: -5 },
      { x: 0, y: 15 }
    ])
    // width = 20, height = 20 → hw = 10, hh = 10
    expect(entityHalfExtents(p)).toEqual({ hw: 10, hh: 10 })
  })

  it('returns null for degenerate polygon', () => {
    const p = makePoly(0, 0, [{ x: 0, y: 0 }])
    expect(entityHalfExtents(p)).toBeNull()
  })
})

// ── normalizePolygonVertices ──

describe('normalizePolygonVertices', () => {
  it('computes centroid and offsets vertices', () => {
    const vertices = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 15, y: 20 }
    ]
    const { centroid, localVertices } = normalizePolygonVertices(vertices)
    expect(centroid.x).toBeCloseTo(15)
    expect(centroid.y).toBeCloseTo(13.333, 2)
    // Each vertex offset by -centroid
    for (let i = 0; i < vertices.length; i++) {
      expect(localVertices[i].x).toBeCloseTo(vertices[i].x - centroid.x)
      expect(localVertices[i].y).toBeCloseTo(vertices[i].y - centroid.y)
    }
  })

  it('is idempotent — already-normalized vertices return (0,0) centroid', () => {
    const vertices = [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 0, y: 5 }
    ]
    const { centroid, localVertices } = normalizePolygonVertices(vertices)
    expect(centroid.x).toBeCloseTo(0)
    expect(centroid.y).toBeCloseTo(-1.667, 2)
    // Re-normalize the result
    const second = normalizePolygonVertices(localVertices)
    expect(second.centroid.x).toBeCloseTo(0, 5)
    expect(second.centroid.y).toBeCloseTo(0, 5)
  })

  it('handles degenerate polygon (<3 vertices)', () => {
    const { centroid, localVertices } = normalizePolygonVertices([{ x: 5, y: 5 }])
    expect(centroid).toEqual({ x: 0, y: 0 })
    expect(localVertices).toEqual([{ x: 5, y: 5 }])
  })
})

// ── boundsOverlap ──

describe('boundsOverlap', () => {
  it('detects overlapping bounds', () => {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
    const b = { minX: 5, maxX: 15, minY: 5, maxY: 15 }
    expect(boundsOverlap(a, b)).toBe(true)
  })

  it('detects non-overlapping bounds', () => {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
    const b = { minX: 20, maxX: 30, minY: 20, maxY: 30 }
    expect(boundsOverlap(a, b)).toBe(false)
  })

  it('detects touching bounds as overlapping', () => {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
    const b = { minX: 10, maxX: 20, minY: 0, maxY: 10 }
    expect(boundsOverlap(a, b)).toBe(true)
  })

  it('detects containment as overlapping', () => {
    const a = { minX: 0, maxX: 20, minY: 0, maxY: 20 }
    const b = { minX: 5, maxX: 10, minY: 5, maxY: 10 }
    expect(boundsOverlap(a, b)).toBe(true)
  })
})
