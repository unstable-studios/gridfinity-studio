import { describe, it, expect } from 'vitest'
import { binFromDrag } from '../draw-bin'

const UNIT = 42

describe('binFromDrag', () => {
  it('makes a 1×1 bin from a drag that stays in one cell', () => {
    expect(binFromDrag({ x: 50, y: 50 }, { x: 60, y: 70 }, UNIT)).toEqual({
      x: 42,
      y: 84,
      width: 42,
      height: 42,
      widthUnits: 1,
      depthUnits: 1
    })
  })

  it('covers every cell from the start to the pointer', () => {
    const bin = binFromDrag({ x: 10, y: 10 }, { x: 100, y: 50 }, UNIT)
    expect(bin).toMatchObject({ x: 0, y: 84, widthUnits: 3, depthUnits: 2 })
    expect(bin.width).toBe(126)
    expect(bin.height).toBe(84)
  })

  it('is the same bin whichever corner the drag starts from', () => {
    const forward = binFromDrag({ x: 10, y: 10 }, { x: 100, y: 50 }, UNIT)
    expect(binFromDrag({ x: 100, y: 50 }, { x: 10, y: 10 }, UNIT)).toEqual(forward)
    expect(binFromDrag({ x: 100, y: 10 }, { x: 10, y: 50 }, UNIT)).toEqual(forward)
  })

  it('works left of and above the origin', () => {
    expect(binFromDrag({ x: -10, y: -10 }, { x: 10, y: 10 }, UNIT)).toMatchObject({
      x: -42,
      y: 42,
      widthUnits: 2,
      depthUnits: 2
    })
  })

  it('stores the lower-left corner: the largest y', () => {
    const bin = binFromDrag({ x: 0, y: 0 }, { x: 1, y: 100 }, UNIT)
    expect(bin.y - bin.height).toBe(0)
    expect(bin.y).toBe(126)
  })

  it('counts a point on a grid line as the cell after the line', () => {
    expect(binFromDrag({ x: 10, y: 10 }, { x: 84, y: 10 }, UNIT)).toMatchObject({ widthUnits: 3 })
  })

  it('works with a base unit that is not a whole number', () => {
    expect(binFromDrag({ x: 1, y: 1 }, { x: 50, y: 1 }, 41.5)).toMatchObject({
      x: 0,
      width: 83,
      widthUnits: 2
    })
  })

  it('follows the base unit', () => {
    expect(binFromDrag({ x: 10, y: 10 }, { x: 60, y: 10 }, 50)).toMatchObject({
      width: 100,
      widthUnits: 2,
      depthUnits: 1
    })
  })
})
