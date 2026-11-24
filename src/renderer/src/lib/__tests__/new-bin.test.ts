import { describe, it, expect } from 'vitest'
import { nextBinName, placeForNewBin } from '../new-bin'

describe('nextBinName', () => {
  it('starts at Bin 1', () => {
    expect(nextBinName([])).toBe('Bin 1')
  })

  it('goes one past the highest number, not the count', () => {
    expect(nextBinName(['Bin 2', 'Bin 3'])).toBe('Bin 4')
  })

  it('ignores names that are not "Bin" and a number', () => {
    expect(nextBinName(['Pliers', 'Bin 1 copy', undefined, 'Bin x'])).toBe('Bin 1')
  })
})

describe('placeForNewBin', () => {
  const UNIT = 42
  /** A bin by its lower-left corner and size, all in grid units. */
  const bin = (
    column: number,
    row: number,
    widthUnits = 1,
    depthUnits = 1
  ): { x: number; y: number; width: number; height: number } => ({
    x: column * UNIT,
    y: row * UNIT,
    width: widthUnits * UNIT,
    height: depthUnits * UNIT
  })
  const overlaps = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y - a.height < b.y && b.y - b.height < a.y

  it('puts the first bin at the origin', () => {
    expect(placeForNewBin([], 2, 3, UNIT)).toEqual({ x: 0, y: 0 })
  })

  it('puts the next bin one grid unit to the right', () => {
    expect(placeForNewBin([bin(0, 0)], 1, 1, UNIT)).toEqual({ x: 2 * UNIT, y: 0 })
    expect(placeForNewBin([bin(0, 0, 2)], 1, 1, UNIT)).toEqual({ x: 3 * UNIT, y: 0 })
  })

  it('starts a new row when the row is full', () => {
    const row = [0, 2, 4, 6, 8, 10].map((column) => bin(column, 0))
    expect(placeForNewBin(row, 1, 1, UNIT)).toEqual({ x: 0, y: 2 * UNIT })
  })

  it('fills a gap left by a deleted bin', () => {
    expect(placeForNewBin([bin(0, 0), bin(4, 0)], 1, 1, UNIT)).toEqual({ x: 2 * UNIT, y: 0 })
  })

  it('skips a gap that is too small for the bin', () => {
    expect(placeForNewBin([bin(0, 0), bin(4, 0)], 2, 1, UNIT)).toEqual({ x: 6 * UNIT, y: 0 })
  })

  it('never lands on or beside a bin, whatever the mix of sizes', () => {
    const placed = [bin(0, 0, 4, 4), bin(5, 0), bin(7, 0, 1, 3)]
    const sizes: Array<[number, number]> = [
      [1, 1],
      [3, 2],
      [6, 1],
      [2, 5],
      [1, 1],
      [14, 1],
      [4, 4]
    ]
    for (const [widthUnits, depthUnits] of sizes) {
      const place = placeForNewBin(placed, widthUnits, depthUnits, UNIT)
      const added = { ...place, width: widthUnits * UNIT, height: depthUnits * UNIT }
      // A unit of room on every side.
      const padded = {
        x: added.x - UNIT + 1,
        y: added.y + UNIT - 1,
        width: added.width + 2 * UNIT - 2,
        height: added.height + 2 * UNIT - 2
      }
      expect(placed.some((other) => overlaps(padded, other))).toBe(false)
      expect(added.x % UNIT).toBe(0)
      expect(added.y % UNIT).toBe(0)
      placed.push(added)
    }
  })

  it('stays on the grid the bins are on, also left of and above the origin', () => {
    expect(placeForNewBin([bin(-3, -2)], 1, 1, UNIT)).toEqual({ x: -1 * UNIT, y: -2 * UNIT })
  })
})
