import { describe, it, expect } from 'vitest'
import { menuTarget, placeBeside, type Bin } from '../menu-target'
import type { LayoutGroup } from '@/layout-engine/types'

const style = { fill: '', stroke: '', strokeWidth: 1 }

/** A bin whose lower-left corner is at column, row on a 42 mm grid. Rows grow downward. */
function bin(id: string, column: number, row: number, widthUnits = 1, depthUnits = 1): Bin {
  return {
    id,
    x: column * 42,
    y: (row + depthUnits) * 42,
    width: widthUnits * 42,
    height: depthUnits * 42,
    rotation: 0,
    childIds: [],
    style,
    metadata: { widthUnits, depthUnits, heightUnits: 3, hasLip: true }
  }
}

const plainGroup: LayoutGroup = { ...bin('plain', 9, 9), metadata: undefined }

describe('menuTarget', () => {
  const groups = [bin('a', 0, 0), bin('b', 2, 0), plainGroup]

  it('is nothing when nothing is selected', () => {
    expect(menuTarget(groups, [])).toEqual({ kind: 'none' })
  })

  it('is the bin when one bin is selected', () => {
    expect(menuTarget(groups, ['b'])).toEqual({ kind: 'bin', bin: groups[1] })
  })

  it('is shapes when no bin is selected', () => {
    expect(menuTarget(groups, ['s1'])).toEqual({ kind: 'shapes' })
    expect(menuTarget(groups, ['s1', 's2'])).toEqual({ kind: 'shapes' })
  })

  it('is mixed for several bins, or a bin with shapes', () => {
    expect(menuTarget(groups, ['a', 'b'])).toEqual({ kind: 'mixed' })
    expect(menuTarget(groups, ['a', 's1'])).toEqual({ kind: 'mixed' })
  })

  it('does not take a group that is not a bin for one', () => {
    expect(menuTarget(groups, ['plain'])).toEqual({ kind: 'shapes' })
  })
})

describe('placeBeside', () => {
  it('puts the new bin against the right edge, the same size', () => {
    const a = bin('a', 0, 0, 2, 1)
    expect(placeBeside(a, [a])).toEqual({
      x: 84,
      y: 42,
      width: 84,
      height: 42,
      widthUnits: 2,
      depthUnits: 1
    })
  })

  it('goes left when the right is taken', () => {
    const a = bin('a', 0, 0)
    expect(placeBeside(a, [a, bin('right', 1, 0)])).toMatchObject({ x: -42, y: 42 })
  })

  it('goes above, then below, when both sides are taken', () => {
    const a = bin('a', 0, 0)
    const sides = [bin('right', 1, 0), bin('left', -1, 0)]
    expect(placeBeside(a, [a, ...sides])).toMatchObject({ x: 0, y: 0 })
    expect(placeBeside(a, [a, ...sides, bin('above', 0, -1)])).toMatchObject({ x: 0, y: 84 })
  })

  it('finds no place when every side is taken', () => {
    const a = bin('a', 0, 0)
    const around = [bin('r', 1, 0), bin('l', -1, 0), bin('u', 0, -1), bin('d', 0, 1)]
    expect(placeBeside(a, [a, ...around])).toBeNull()
  })

  it('counts a place as taken when a bin covers only part of it', () => {
    const a = bin('a', 0, 0, 2, 2)
    // A 1×1 bin in the far corner of where the new 2×2 would go.
    expect(placeBeside(a, [a, bin('corner', 3, 1)])).toMatchObject({ x: -84 })
  })

  it('lets the new bin touch a bin that is one place further on', () => {
    const a = bin('a', 0, 0)
    expect(placeBeside(a, [a, bin('further', 2, 0)])).toMatchObject({ x: 42 })
  })
})
