import { describe, it, expect } from 'vitest'
import { snapLowerLeft, quantizeResize, computeEdgeAnchor } from '../input-math'

describe('snapLowerLeft', () => {
  it('snaps to nearest grid intersection', () => {
    expect(snapLowerLeft(43, 85, 42)).toEqual({ x: 42, y: 84 })
  })

  it('returns exact position when already on grid', () => {
    expect(snapLowerLeft(84, 126, 42)).toEqual({ x: 84, y: 126 })
  })

  it('rounds correctly at midpoint (Math.round(0.5) = 1)', () => {
    // 21/42 = 0.5 → Math.round(0.5) = 1 → 1 * 42 = 42
    expect(snapLowerLeft(21, 21, 42)).toEqual({ x: 42, y: 42 })
  })

  it('handles negative coordinates', () => {
    expect(snapLowerLeft(-43, -85, 42)).toEqual({ x: -42, y: -84 })
  })

  it('handles small grid sizes', () => {
    expect(snapLowerLeft(1.3, 2.7, 1)).toEqual({ x: 1, y: 3 })
  })
})

describe('quantizeResize', () => {
  it('rounds dimensions to nearest grid unit', () => {
    expect(quantizeResize(85, 130, 42)).toEqual({ width: 84, height: 126 })
  })

  it('enforces minimum of one grid unit', () => {
    expect(quantizeResize(5, 10, 42)).toEqual({ width: 42, height: 42 })
  })

  it('returns exact dimensions when already on grid', () => {
    expect(quantizeResize(84, 126, 42)).toEqual({ width: 84, height: 126 })
  })

  it('handles fractional grid sizes', () => {
    expect(quantizeResize(15, 25, 10)).toEqual({ width: 20, height: 30 })
  })
})

describe('computeEdgeAnchor', () => {
  const base = { x: 0, y: 84, width: 84, height: 84 }
  // Original centroid: cx = 0 + 84/2 = 42, cy = 84 - 84/2 = 42

  it('anchors left edge when centroid shifts right (dragging right edge)', () => {
    // Dragging right edge rightward: centroid shifts right from 42 to 84
    // visualLeft = 84 - 84*2/2 = 0 → diff from origLeft(0) = 0 (anchored!)
    // visualRight = 84 + 84*2/2 = 168 → diff from origRight(84) = 84
    const result = computeEdgeAnchor(base, 2, 1, 84, 42, 42)
    expect(result.x).toBe(0) // left edge anchored
    expect(result.width).toBe(168)
    expect(result.height).toBe(84) // unchanged
  })

  it('anchors right edge when centroid shifts left (dragging left edge)', () => {
    // Dragging left edge leftward: centroid shifts left from 42 to 0
    // visualLeft = 0 - 84*2/2 = -84 → diff from origLeft(0) = 84
    // visualRight = 0 + 84*2/2 = 84 → diff from origRight(84) = 0 (anchored!)
    const result = computeEdgeAnchor(base, 2, 1, 0, 42, 42)
    expect(result.x).toBe(84 - 168) // right edge anchored: origRight - newW
    expect(result.width).toBe(168)
  })

  it('anchors bottom edge when centroid shifts up (dragging top edge)', () => {
    // Dragging top edge upward: centroid shifts up (smaller y) from 42 to 0
    // visualTop = 0 - 84*2/2 = -84 → diff from origTop(0) = 84
    // visualBottom = 0 + 84*2/2 = 84 → diff from origBottom(84) = 0 (anchored!)
    const result = computeEdgeAnchor(base, 1, 2, 42, 0, 42)
    expect(result.y).toBe(84) // bottom edge anchored
    expect(result.height).toBe(168)
  })

  it('snaps dimensions to grid', () => {
    // 84 * 1.5 = 126, already on grid. Centroid shifts right and up.
    const result = computeEdgeAnchor(base, 1.5, 1.5, 63, 21, 42)
    expect(result.width).toBe(126)
    expect(result.height).toBe(126)
  })

  it('enforces minimum grid unit', () => {
    // Shrinking to tiny: centroid stays roughly centered
    const result = computeEdgeAnchor(base, 0.1, 0.1, 42, 42, 42)
    expect(result.width).toBe(42)
    expect(result.height).toBe(42)
  })
})
