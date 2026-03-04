import { describe, it, expect } from 'vitest'
import { resolveSnapTargets, snapToNearest } from '../snap'
import type { SnapTarget } from '../snap'

describe('resolveSnapTargets', () => {
  it('grid snap: cursor near grid intersection returns grid target', () => {
    const targets = resolveSnapTargets({ x: 1, y: 1 }, 42, [], 10)

    const gridTargets = targets.filter((t: SnapTarget) => t.type === 'grid')
    expect(gridTargets.length).toBeGreaterThan(0)

    // The nearest grid point to (1,1) with gridSize=42 should be (0,0)
    const nearest = gridTargets[0]
    expect(nearest.point.x).toBeCloseTo(0)
    expect(nearest.point.y).toBeCloseTo(0)
  })

  it('grid snap: cursor at (21, 21) with gridSize=42 snaps to nearest intersection', () => {
    const targets = resolveSnapTargets({ x: 21, y: 21 }, 42, [], 30)

    const gridTargets = targets.filter((t: SnapTarget) => t.type === 'grid')
    expect(gridTargets.length).toBeGreaterThan(0)

    // (21,21) is equidistant from (0,0) and (42,0) and (0,42) and (42,42)
    // Should return at least one of these intersections
    const points = gridTargets.map((t: SnapTarget) => t.point)
    const hasValidSnap = points.some(
      (p: { x: number; y: number }) =>
        Math.abs(p.x) <= 42 &&
        Math.abs(p.y) <= 42 &&
        (p.x % 42 === 0 || Math.abs(p.x % 42) < 0.001) &&
        (p.y % 42 === 0 || Math.abs(p.y % 42) < 0.001)
    )
    expect(hasValidSnap).toBe(true)
  })

  it('entity center snap: cursor near entity position returns entity-center target', () => {
    const entities = [
      {
        type: 'rectangle',
        transform: { position: { x: 100, y: 100 } },
        width: 42,
        height: 42
      }
    ]

    const targets = resolveSnapTargets({ x: 98, y: 102 }, 42, entities, 10)

    const centerTargets = targets.filter((t: SnapTarget) => t.type === 'entity-center')
    expect(centerTargets.length).toBeGreaterThan(0)
    expect(centerTargets[0].point.x).toBeCloseTo(100)
    expect(centerTargets[0].point.y).toBeCloseTo(100)
  })

  it('entity edge snap: cursor near rectangle edge midpoint returns entity-edge target', () => {
    const entities = [
      {
        type: 'rectangle',
        transform: { position: { x: 0, y: 0 } },
        width: 42,
        height: 42
      }
    ]

    // Near the right edge midpoint (21, 0)
    const targets = resolveSnapTargets({ x: 20, y: 0 }, 42, entities, 10)

    const edgeTargets = targets.filter((t: SnapTarget) => t.type === 'entity-edge')
    expect(edgeTargets.length).toBeGreaterThan(0)
  })

  it('threshold filtering: targets beyond threshold are excluded', () => {
    const targets = resolveSnapTargets({ x: 100, y: 100 }, 42, [], 2)

    // With a very small threshold at (100,100), nearest grid point is (84,84) or (126,126)
    // which are far beyond threshold=2
    const gridTargets = targets.filter((t: SnapTarget) => t.type === 'grid')
    expect(gridTargets.length).toBe(0)
  })

  it('results are sorted by distance (nearest first)', () => {
    const entities = [
      {
        type: 'rectangle',
        transform: { position: { x: 5, y: 5 } },
        width: 42,
        height: 42
      },
      {
        type: 'rectangle',
        transform: { position: { x: 50, y: 50 } },
        width: 42,
        height: 42
      }
    ]

    const cursor = { x: 3, y: 3 }
    const targets = resolveSnapTargets(cursor, 42, entities, 100)

    // Verify sorted by computing distances manually
    for (let i = 1; i < targets.length; i++) {
      const distPrev = Math.sqrt(
        (targets[i - 1].point.x - cursor.x) ** 2 + (targets[i - 1].point.y - cursor.y) ** 2
      )
      const distCurr = Math.sqrt(
        (targets[i].point.x - cursor.x) ** 2 + (targets[i].point.y - cursor.y) ** 2
      )
      expect(distCurr).toBeGreaterThanOrEqual(distPrev)
    }
  })

  it('empty entities array: only returns grid targets', () => {
    const targets = resolveSnapTargets({ x: 0, y: 0 }, 42, [], 10)

    const nonGridTargets = targets.filter((t: SnapTarget) => t.type !== 'grid')
    expect(nonGridTargets.length).toBe(0)
  })
})

describe('snapToNearest', () => {
  it('returns nearest target point', () => {
    const targets: SnapTarget[] = [
      { type: 'grid', point: { x: 0, y: 0 } },
      { type: 'grid', point: { x: 42, y: 0 } }
    ]

    const result = snapToNearest({ x: 1, y: 1 }, targets)
    expect(result).toBeDefined()
    expect(result!.x).toBeCloseTo(0)
    expect(result!.y).toBeCloseTo(0)
  })

  it('returns null when no targets', () => {
    const result = snapToNearest({ x: 0, y: 0 }, [])
    expect(result).toBeNull()
  })
})
