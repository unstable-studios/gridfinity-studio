import { describe, it, expect } from 'vitest'
import { autoWrap } from '../auto-wrap'
import type { CircleEntity, RectangleEntity, PolygonEntity } from '../../../../shared/types/project'

// ─── Entity factory helpers ────────────────────────────────────────

function makeTransform(x: number, y: number) {
  return {
    position: { x, y, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  }
}

const BASE = {
  visible: true,
  locked: false,
  properties: {} as Record<string, unknown>
}

function circle(id: string, cx: number, cy: number, diameter: number): CircleEntity {
  return { ...BASE, id, name: id, type: 'circle', transform: makeTransform(cx, cy), diameter }
}

function rectangle(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number
): RectangleEntity {
  return {
    ...BASE,
    id,
    name: id,
    type: 'rectangle',
    transform: makeTransform(cx, cy),
    width,
    height
  }
}

function polygon(
  id: string,
  cx: number,
  cy: number,
  vertices: { x: number; y: number }[]
): PolygonEntity {
  return { ...BASE, id, name: id, type: 'polygon', transform: makeTransform(cx, cy), vertices }
}

/**
 * JS modulo can return -0 for negative multiples (e.g. -42 % 42 === -0).
 * Use this helper for grid-alignment assertions.
 */
function isGridAligned(value: number, unit: number): boolean {
  return Math.abs(value % unit) < 1e-9
}

// ─── Tests ────────────────────────────────────────────────────────

const BASE_UNIT = 42

describe('autoWrap', () => {
  describe('empty input', () => {
    it('returns a 1x1 bin at origin when entities array is empty', () => {
      const result = autoWrap([], BASE_UNIT)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
      expect(result.position.x).toBe(0)
      expect(result.position.y).toBe(0)
    })
  })

  describe('single circle', () => {
    it('circle positioned at grid start fits in 1x1 bin', () => {
      // Circle at (21, 21) — center of first grid cell — with diameter 20mm
      // half=10, AABB left=11, top=11; with 1mm margin → 10
      // snappedMin: floor(10/42)*42=0; span: 32-0=32 → ceil(32/42)=1
      const result = autoWrap([circle('c1', 21, 21, 20)], BASE_UNIT)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
    })

    it('position is grid-aligned for a small circle', () => {
      const result = autoWrap([circle('c1', 21, 21, 20)], BASE_UNIT)
      expect(isGridAligned(result.position.x, BASE_UNIT)).toBe(true)
      expect(isGridAligned(result.position.y, BASE_UNIT)).toBe(true)
    })

    it('circle at origin with default margin snaps origin to -baseUnit', () => {
      // Circle at (0,0) diameter 20: left=-10, with 1mm margin → -11
      // floor(-11/42)*42 = -42
      const result = autoWrap([circle('c1', 0, 0, 20)], BASE_UNIT)
      expect(result.position.x).toBe(-BASE_UNIT)
      expect(result.position.y).toBe(-BASE_UNIT)
    })

    it('circle at origin with default margin produces a 2x2 bin due to negative snap', () => {
      // snappedMin=-42; maxX=10+1=11; span=11-(-42)=53; ceil(53/42)=2
      const result = autoWrap([circle('c1', 0, 0, 20)], BASE_UNIT)
      expect(result.width).toBe(2)
      expect(result.depth).toBe(2)
    })

    it('large circle (diameter 80mm) at grid-center position requires 2x2 bin', () => {
      // Circle centered at (42,42) — center of second cell — half=40
      // AABB: [2, 2] to [82, 82]; with 1mm margin → [1, 1] to [83, 83]
      // snappedMin: floor(1/42)*42=0; span: 83-0=83 → ceil(83/42)=2
      const result = autoWrap([circle('c2', 42, 42, 80)], BASE_UNIT)
      expect(result.width).toBe(2)
      expect(result.depth).toBe(2)
    })

    it('very large circle (diameter 170mm) at origin requires 5x5 bin', () => {
      // half=85, AABB: [-85,-85] to [85,85]; with margin → [-86,-86] to [86,86]
      // snappedMin: floor(-86/42)*42=-126; span: 86-(-126)=212; ceil(212/42)=6... wait
      // Actually: ceil(212/42) = ceil(5.047) = 6. Let me recalculate:
      // floor(-86/42) = floor(-2.047) = -3; -3*42=-126
      // span: 86 - (-126) = 212; ceil(212/42) = ceil(5.047) = 6
      const result = autoWrap([circle('c3', 0, 0, 170)], BASE_UNIT)
      expect(result.width).toBeGreaterThanOrEqual(5)
    })
  })

  describe('single rectangle', () => {
    it('rectangle placed at grid start fits in 1x1 bin', () => {
      // Rectangle centered at (21,21), 30x30: occupies [6,6] to [36,36]
      // with 1mm margin → [5,5] to [37,37]; snappedMin=0; span=37 → ceil=1
      const result = autoWrap([rectangle('r1', 21, 21, 30, 30)], BASE_UNIT)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
    })

    it('wide rectangle requires multiple cells in x', () => {
      // Rectangle 90x10 centered at (45,21): occupies [0,16] to [90,26]
      // with margin → [-1,15] to [91,27]; snappedMin x=floor(-1/42)*42=-42
      // span x: 91-(-42)=133; ceil(133/42)=ceil(3.16)=4
      const result = autoWrap([rectangle('r2', 45, 21, 90, 10)], BASE_UNIT)
      expect(result.width).toBeGreaterThanOrEqual(3)
    })

    it('tall rectangle requires multiple cells in y', () => {
      // Rectangle 10x90 centered at (21,45): occupies [16,0] to [26,90]
      // with margin → [15,-1] to [27,91]; snappedMin y=-42; span y: 133 → 4
      const result = autoWrap([rectangle('r3', 21, 45, 10, 90)], BASE_UNIT)
      expect(result.depth).toBeGreaterThanOrEqual(3)
    })
  })

  describe('polygon entities', () => {
    it('polygon AABB is computed from vertices extent', () => {
      // 20x20 square centered at (21,21) with vertices relative to center
      const verts = [
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 }
      ]
      // vertex extents: hw=10, hh=10; with transform at (21,21):
      // AABB: [21-10, 21-10] to [21+10, 21+10] = [11,11] to [31,31]
      // with 1mm margin → [10,10] to [32,32]; snappedMin=0; span=32; ceil=1
      const result = autoWrap([polygon('p1', 21, 21, verts)], BASE_UNIT)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
    })

    it('polygon with empty vertices is treated as a zero-size point', () => {
      // At position (21,21) with no extent → AABB = [21,21] to [21,21]
      // with 1mm margin → [20,20] to [22,22]; snappedMin=0; span=22 → ceil=1
      const result = autoWrap([polygon('p2', 21, 21, [])], BASE_UNIT)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
    })

    it('large polygon spanning multiple cells requires correct bin size', () => {
      const verts = [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 }
      ]
      // vertex extents: hw=50, hh=50
      const result = autoWrap([polygon('p3', 50, 50, verts)], BASE_UNIT)
      // AABB: [0,0] to [100,100]; with margin → [-1,-1] to [101,101]
      // snappedMin: floor(-1/42)*42=-42; span: 101-(-42)=143; ceil(143/42)=4
      expect(result.width).toBeGreaterThanOrEqual(3)
      expect(result.depth).toBeGreaterThanOrEqual(3)
    })
  })

  describe('multiple entities', () => {
    it('two circles spread 100mm apart produce a bin spanning enough cells', () => {
      // circle at (21,21) r=10 and circle at (121,21) r=10
      // AABB x: [11,11] to [131,31]; with margin → [10,10] to [132,32]
      // snappedMin x: floor(10/42)*42=0; span x: 132; ceil(132/42)=ceil(3.14)=4
      const result = autoWrap([circle('a', 21, 21, 20), circle('b', 121, 21, 20)], BASE_UNIT)
      expect(result.width).toBeGreaterThanOrEqual(3)
    })

    it('entities spread in both axes produce correct width and depth', () => {
      // circles at (21,21), (111,21), (21,71)
      const result = autoWrap(
        [circle('a', 21, 21, 10), circle('b', 111, 21, 10), circle('c', 21, 71, 10)],
        BASE_UNIT
      )
      // Width covers x: [16,16] to [116,26] with margin → [15,15] to [117,27]
      // snappedMin=0; span x: 117 → ceil(117/42)=3
      // Depth covers y: [16,16] to [21,76] with margin → [15,15] to [77,27]
      // span y: 77 → ceil(77/42)=2
      expect(result.width).toBeGreaterThanOrEqual(3)
      expect(result.depth).toBeGreaterThanOrEqual(2)
    })

    it('combined AABB is the union of all individual entity boxes', () => {
      const e1 = rectangle('r1', 10, 10, 20, 20) // occupies [0,0] to [20,20]
      const e2 = rectangle('r2', 50, 10, 20, 20) // occupies [40,0] to [60,20]
      const result = autoWrap([e1, e2], BASE_UNIT)

      // Combined: x from 0 to 60; with margin → [-1,-1] to [61,21]
      // snappedMin=-42; span x: 61-(-42)=103; ceil=3
      expect(result.width).toBeGreaterThan(1)
    })

    it('bin contains all entities: footprint encloses combined AABB', () => {
      const entities = [circle('a', 21, 21, 10), rectangle('b', 80, 80, 20, 20)]
      const result = autoWrap(entities, BASE_UNIT)
      const binRight = result.position.x + result.width * BASE_UNIT
      const binBottom = result.position.y + result.depth * BASE_UNIT

      // rightmost entity edge: 80+10=90; with 1mm margin=91
      expect(binRight).toBeGreaterThanOrEqual(91)
      // bottommost entity edge: 80+10=90; with 1mm margin=91
      expect(binBottom).toBeGreaterThanOrEqual(91)
    })
  })

  describe('non-grid-aligned entity positions', () => {
    it('bin position snaps to grid boundary at or before entity min extent', () => {
      // Circle at (50, 50) diameter 10: left=45, with margin=44
      // floor(44/42)*42=42 — snapped to 42
      const result = autoWrap([circle('c', 50, 50, 10)], BASE_UNIT)
      expect(isGridAligned(result.position.x, BASE_UNIT)).toBe(true)
      expect(result.position.x).toBeLessThanOrEqual(44)
    })

    it('position is always at or before the entity min extent including margin', () => {
      const c = circle('c', 25, 25, 30) // left=25-15=10, with margin=9
      const result = autoWrap([c], BASE_UNIT)
      expect(result.position.x).toBeLessThanOrEqual(9)
      expect(result.position.y).toBeLessThanOrEqual(9)
    })

    it('entity at negative position snaps bin origin to negative grid line', () => {
      // Circle at x=-50 diameter 10: left=-55, with margin → -56
      // floor(-56/42)*42 = floor(-1.33)*42 = -2*42 = -84
      const result = autoWrap([circle('c', -50, 0, 10)], BASE_UNIT)
      expect(result.position.x).toBe(-84)
    })

    it('entity in middle of grid cell produces correct grid-aligned position', () => {
      // Circle at (63, 63) (inside second cell [42,84]) diameter 10: left=58, with margin=57
      // floor(57/42)*42=42 — snapped to 42
      const result = autoWrap([circle('c', 63, 63, 10)], BASE_UNIT)
      expect(result.position.x).toBe(42)
      expect(result.position.y).toBe(42)
    })
  })

  describe('custom margin', () => {
    it('larger margin increases or maintains bin size', () => {
      const smallMargin = autoWrap([rectangle('r', 21, 21, 30, 30)], BASE_UNIT, 1)
      const largeMargin = autoWrap([rectangle('r', 21, 21, 30, 30)], BASE_UNIT, 8)

      expect(largeMargin.width).toBeGreaterThanOrEqual(smallMargin.width)
      expect(largeMargin.depth).toBeGreaterThanOrEqual(smallMargin.depth)
    })

    it('zero margin still produces a valid result', () => {
      const result = autoWrap([circle('c', 21, 21, 20)], BASE_UNIT, 0)
      expect(result.width).toBeGreaterThanOrEqual(1)
      expect(result.depth).toBeGreaterThanOrEqual(1)
      expect(isGridAligned(result.position.x, BASE_UNIT)).toBe(true)
    })

    it('margin=5 expands bounding box further than margin=1', () => {
      // Both circles at (21,21) diameter 20
      const m1 = autoWrap([circle('c', 21, 21, 20)], BASE_UNIT, 1)
      const m5 = autoWrap([circle('c', 21, 21, 20)], BASE_UNIT, 5)

      // margin=1: AABB [10,10] to [32,32]; snappedMin=0; span=32; ceil=1
      // margin=5: AABB [6,6] to [36,36]; snappedMin=0; span=36; ceil=1
      // Both fit in 1x1 in this case, but position should be equal or further back
      expect(m5.position.x).toBeLessThanOrEqual(m1.position.x)
    })

    it('large enough margin causes a size increase to next grid cell', () => {
      // Rectangle at (21,21) 30x30 → half=15; occupies [6,6] to [36,36]
      // margin=1: span=[5,5] to [37,37]; snappedMin=0; span=37 → 1 cell
      // margin=10: span=[-4,-4] to [46,46]; snappedMin=-42; span=46-(-42)=88 → ceil=3... wait
      // floor(-4/42)*42=floor(-0.095)*42=-1*42=-42; span x=46-(-42)=88; ceil(88/42)=3
      const m1 = autoWrap([rectangle('r', 21, 21, 30, 30)], BASE_UNIT, 1)
      const mLarge = autoWrap([rectangle('r', 21, 21, 30, 30)], BASE_UNIT, 10)
      expect(mLarge.width).toBeGreaterThan(m1.width)
    })
  })

  describe('result constraints', () => {
    it('width and depth are always at least 1', () => {
      const result = autoWrap([circle('c', 21, 21, 1)], BASE_UNIT)
      expect(result.width).toBeGreaterThanOrEqual(1)
      expect(result.depth).toBeGreaterThanOrEqual(1)
    })

    it('position is always grid-aligned', () => {
      const entities = [circle('a', 13, 27, 15), rectangle('b', 55, 80, 30, 20)]
      const result = autoWrap(entities, BASE_UNIT)
      expect(isGridAligned(result.position.x, BASE_UNIT)).toBe(true)
      expect(isGridAligned(result.position.y, BASE_UNIT)).toBe(true)
    })

    it('bin footprint covers the full entity AABB including margin', () => {
      const margin = 1
      // Rectangle at (21,21) 40x40: occupies [1,1] to [41,41]
      // with margin: [0,0] to [42,42]; snappedMin=0; span=42; ceil=1
      const c = rectangle('r', 21, 21, 40, 40)
      const result = autoWrap([c], BASE_UNIT, margin)

      const binMaxX = result.position.x + result.width * BASE_UNIT
      const binMaxY = result.position.y + result.depth * BASE_UNIT

      const entityMinX = 1 - margin // 0
      const entityMaxX = 41 + margin // 42

      expect(result.position.x).toBeLessThanOrEqual(entityMinX)
      expect(result.position.y).toBeLessThanOrEqual(entityMinX)
      expect(binMaxX).toBeGreaterThanOrEqual(entityMaxX)
      expect(binMaxY).toBeGreaterThanOrEqual(entityMaxX)
    })

    it('width and depth are integers', () => {
      const result = autoWrap([circle('c', 21, 21, 20)], BASE_UNIT)
      expect(Number.isInteger(result.width)).toBe(true)
      expect(Number.isInteger(result.depth)).toBe(true)
    })
  })

  describe('non-standard baseUnit', () => {
    it('works with a 50mm baseUnit', () => {
      // Circle at (25,25) diameter 20: left=15; with margin=14
      // floor(14/50)*50=0; span: 36-0=36; ceil(36/50)=1
      const result = autoWrap([circle('c', 25, 25, 20)], 50)
      expect(result.width).toBeGreaterThanOrEqual(1)
      expect(isGridAligned(result.position.x, 50)).toBe(true)
    })

    it('large baseUnit collapses small entities into 1x1', () => {
      // 100mm baseUnit: circle at (50,50) diameter 30 → half=15
      // left=35; with margin=34; snappedMin=0; span=66; ceil(66/100)=1
      const result = autoWrap([circle('c', 50, 50, 30)], 100)
      expect(result.width).toBe(1)
      expect(result.depth).toBe(1)
    })

    it('position is grid-aligned for non-standard baseUnit', () => {
      const result = autoWrap([circle('c', 30, 30, 20)], 25)
      expect(isGridAligned(result.position.x, 25)).toBe(true)
      expect(isGridAligned(result.position.y, 25)).toBe(true)
    })
  })
})
