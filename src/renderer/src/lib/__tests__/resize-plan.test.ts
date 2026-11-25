import { describe, it, expect } from 'vitest'
import { planResize } from '../resize-plan'
import type { LayoutGroup } from '@/layout-engine/types'

const U = 42

/** A bin whose lower-left grid square is at column, row. Rows grow downward. */
function bin(id: string, column: number, row: number, wide = 1, deep = 1): LayoutGroup {
  return {
    id,
    x: column * U,
    y: (row + 1) * U,
    width: wide * U,
    height: deep * U,
    rotation: 0,
    childIds: [],
    style: { fill: '', stroke: '', strokeWidth: 1 }
  }
}

/** The plan for `a` at a new size in grid units, as columns and rows moved. */
function plan(a: LayoutGroup, wide: number, deep: number, others: LayoutGroup[]) {
  const result = planResize(a, wide * U, deep * U, [a, ...others], U)
  if (!result.ok) return { blockedBy: result.blockedBy.id }
  return { dx: (result.x - a.x) / U, dy: (result.y - a.y) / U, moved: result.moved }
}

describe('planResize', () => {
  it('leaves the bin where it is when there is room to grow right and up', () => {
    expect(plan(bin('a', 0, 0), 3, 2, [bin('far', 5, 0)])).toEqual({ dx: 0, dy: 0, moved: false })
  })

  it('lets the bin grow until it touches a neighbor', () => {
    expect(plan(bin('a', 0, 0), 2, 1, [bin('b', 2, 0)])).toEqual({ dx: 0, dy: 0, moved: false })
  })

  it('grows the other way when a bin is in the way on the right', () => {
    // Three wide would cover the bin two squares along. One square left, it only touches it.
    expect(plan(bin('a', 0, 0), 3, 1, [bin('b', 2, 0)])).toEqual({ dx: -1, dy: 0, moved: true })
  })

  it('goes sideways for a wider bin when up, down and sideways are as near', () => {
    // Right of it is taken. Left and below are both free and one square away.
    expect(plan(bin('a', 0, 0), 2, 1, [bin('b', 1, 0)])).toEqual({ dx: -1, dy: 0, moved: true })
  })

  it('goes up or down for a deeper bin, though sideways is as near', () => {
    expect(plan(bin('a', 0, 0), 1, 2, [bin('above', 0, -1)])).toEqual({
      dx: 0,
      dy: 1,
      moved: true
    })
  })

  it('takes the nearest free place when the near ones are taken', () => {
    const others = [bin('right', 1, 0), bin('left', -2, 0, 2, 1)]
    // Sideways is taken both ways, so it goes up or down a row: up first.
    expect(plan(bin('a', 0, 0), 2, 1, others)).toEqual({ dx: 0, dy: -1, moved: true })
  })

  it('refuses when nothing within its own size is free, and names what is in the way', () => {
    // A wall of bins all around, further out than a two-wide bin may go.
    const wall: LayoutGroup[] = []
    for (let column = -4; column <= 5; column++) {
      for (let row = -3; row <= 3; row++) {
        if (column !== 0 || row !== 0) wall.push(bin(`w${column},${row}`, column, row))
      }
    }
    expect(plan(bin('a', 0, 0), 2, 1, wall)).toEqual({ blockedBy: 'w1,0' })
  })

  it('does not count the bin itself as in its way', () => {
    const a = bin('a', 0, 0, 2, 2)
    expect(plan(a, 3, 3, [])).toEqual({ dx: 0, dy: 0, moved: false })
  })

  it('always ends in the same place for the same layout', () => {
    const others = [bin('b', 1, 0), bin('c', 0, -1)]
    const first = plan(bin('a', 0, 0), 2, 2, others)
    expect(plan(bin('a', 0, 0), 2, 2, [...others].reverse())).toEqual(first)
  })
})
