import { describe, expect, it } from 'vitest'
import { pocketWallIssue, wallLeft, wallWarnings } from '../wall-clearance'
import type { CSGBinParams, PocketSpec } from '../../../../shared/types/worker'

function bin(overrides: Partial<CSGBinParams> = {}): CSGBinParams {
  return {
    name: 'Bin 1',
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 3,
    baseUnit: 42,
    unitHeight: 7,
    tolerance: 0.25,
    hasLip: false,
    magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 },
    pockets: [],
    ...overrides
  }
}

/** A rectangular pocket `width` by `depth`, centered at (x, y) in the bin. */
function rect(width: number, depth: number, x = 0, y = 0, overrides = {}): PocketSpec {
  const hw = width / 2
  const hd = depth / 2
  return {
    name: 'Rectangle 1',
    vertices: new Float32Array([-hw, -hd, hw, -hd, hw, hd, -hw, hd]),
    depth: 5,
    clearance: 0,
    posX: x,
    posY: y,
    zTop: 21,
    ...overrides
  }
}

describe('wallLeft', () => {
  // A 1x1 bin with 0.25 tolerance is 41.5 wide: its wall is 20.75 from the center.
  it('measures from the closest side of the pocket to the outside of the bin', () => {
    expect(wallLeft(bin(), rect(10, 10))).toBeCloseTo(15.75, 5)
    expect(wallLeft(bin(), rect(10, 10, 10, 0))).toBeCloseTo(5.75, 5)
    expect(wallLeft(bin(), rect(10, 10, 0, -12))).toBeCloseTo(3.75, 5)
  })

  it('counts the clearance the pocket is cut with', () => {
    expect(wallLeft(bin(), rect(10, 10, 10, 0, { clearance: 0.5 }))).toBeCloseTo(5.25, 5)
  })

  it('is negative for a pocket that crosses the wall', () => {
    expect(wallLeft(bin(), rect(10, 10, 18, 0))).toBeCloseTo(-2.25, 5)
  })

  it('follows the rounded corner, where the wall is closer than either side', () => {
    // The corner of this pocket is 1.75 from each side, but closer to the corner's arc.
    const left = wallLeft(bin(), rect(38, 38))
    expect(left).toBeLessThan(1.75)
    expect(left).toBeCloseTo(3.75 - Math.hypot(2, 2), 5)
  })

  it('uses the whole bin, not one grid square', () => {
    expect(wallLeft(bin({ widthUnits: 2 }), rect(10, 10, 21, 0))).toBeCloseTo(15.75, 5)
  })
})

describe('pocketWallIssue', () => {
  it('finds nothing wrong with a pocket well inside the bin', () => {
    expect(pocketWallIssue(bin({ hasLip: true }), rect(20, 20))).toBeNull()
  })

  it('reports a thin wall when less than 0.95 mm is left', () => {
    // 41.5 - 40 = 1.5, so 0.75 on each side.
    expect(pocketWallIssue(bin(), rect(40, 10))).toBe('thin-wall')
    expect(pocketWallIssue(bin({ hasLip: true }), rect(40, 10))).toBe('thin-wall')
  })

  it('accepts a wall of exactly 0.95 mm', () => {
    expect(pocketWallIssue(bin(), rect(41.5 - 2 * 0.95, 10))).toBeNull()
  })

  it('reports a cut lip only on a bin that has one', () => {
    // 2 mm from each side: enough wall, but inside the lip's 2.85 mm.
    expect(pocketWallIssue(bin({ hasLip: true }), rect(37.5, 10))).toBe('cuts-lip')
    expect(pocketWallIssue(bin({ hasLip: false }), rect(37.5, 10))).toBeNull()
  })

  it('accepts a pocket drawn on the lip line', () => {
    expect(pocketWallIssue(bin({ hasLip: true }), rect(41.5 - 2 * 2.85, 10))).toBeNull()
  })

  it('judges the lip by the outline as drawn, and the wall by the outline as cut', () => {
    const onLipLine = rect(41.5 - 2 * 2.85, 10, 0, 0, { clearance: 0.25 })
    expect(pocketWallIssue(bin({ hasLip: true }), onLipLine)).toBeNull()
    // 1.1 mm from the wall as drawn, 0.85 mm once the clearance is cut.
    const nearWall = rect(41.5 - 2 * 1.1, 10, 0, 0, { clearance: 0.25 })
    expect(pocketWallIssue(bin(), nearWall)).toBe('thin-wall')
  })
})

describe('wallWarnings', () => {
  it('says nothing about a bin with no issues', () => {
    expect(wallWarnings(bin({ pockets: [rect(10, 10)] }))).toEqual([])
  })

  it('names the bin and the shape', () => {
    expect(wallWarnings(bin({ pockets: [rect(10, 10), rect(40, 10)] }))).toEqual([
      'Bin 1: Rectangle 1 leaves a wall thinner than 0.95 mm.'
    ])
  })

  it('counts the shapes when there are several, one warning per kind', () => {
    const params = bin({
      hasLip: true,
      pockets: [rect(40, 10), rect(10, 40), rect(37.5, 10)]
    })
    expect(wallWarnings(params)).toEqual([
      'Bin 1: 2 shapes leave a wall thinner than 0.95 mm.',
      'Bin 1: Rectangle 1 cuts into the stacking lip.'
    ])
  })

  it('leaves out pockets that were not cut', () => {
    const params = bin({ pockets: [rect(40, 10), rect(10, 40)] })
    expect(wallWarnings(params, [0])).toEqual([
      'Bin 1: Rectangle 1 leaves a wall thinner than 0.95 mm.'
    ])
    expect(wallWarnings(params, [0, 1])).toEqual([])
  })

  it('still reads well when nothing has a name', () => {
    const params = bin({ name: undefined, pockets: [rect(40, 10, 0, 0, { name: undefined })] })
    expect(wallWarnings(params)).toEqual(['A shape leaves a wall thinner than 0.95 mm.'])
  })
})
