import { describe, it, expect } from 'vitest'
import { alignMoves, boundsOf, distributeMoves } from '../arrange'
import type { ArrangeBox } from '../arrange'

const box = (id: string, minX: number, minY: number, w: number, h: number): ArrangeBox => ({
  id,
  minX,
  minY,
  maxX: minX + w,
  maxY: minY + h
})

// a: 10 wide at x 0..10, y 0..10. b: 20 wide at x 30..50, y 20..30.
// c: at x 60..70, y 50..90.
const boxes = [box('a', 0, 0, 10, 10), box('b', 30, 20, 20, 10), box('c', 60, 50, 10, 40)]

describe('boundsOf', () => {
  it('encloses every box', () => {
    expect(boundsOf(boxes)).toEqual({ minX: 0, minY: 0, maxX: 70, maxY: 90 })
  })
})

describe('alignMoves', () => {
  it('aligns left edges to the leftmost edge', () => {
    expect(alignMoves(boxes, 'left')).toEqual([
      { id: 'b', dx: -30, dy: 0 },
      { id: 'c', dx: -60, dy: 0 }
    ])
  })

  it('aligns right edges to the rightmost edge', () => {
    expect(alignMoves(boxes, 'right')).toEqual([
      { id: 'a', dx: 60, dy: 0 },
      { id: 'b', dx: 20, dy: 0 }
    ])
  })

  it('aligns horizontal centers to the center of the selection', () => {
    expect(alignMoves(boxes, 'centerX')).toEqual([
      { id: 'a', dx: 30, dy: 0 },
      { id: 'b', dx: -5, dy: 0 },
      { id: 'c', dx: -30, dy: 0 }
    ])
  })

  it('aligns top edges to the topmost edge', () => {
    expect(alignMoves(boxes, 'top')).toEqual([
      { id: 'b', dx: 0, dy: -20 },
      { id: 'c', dx: 0, dy: -50 }
    ])
  })

  it('aligns bottom edges to the lowest edge', () => {
    expect(alignMoves(boxes, 'bottom')).toEqual([
      { id: 'a', dx: 0, dy: 80 },
      { id: 'b', dx: 0, dy: 60 }
    ])
  })

  it('aligns vertical centers to the center of the selection', () => {
    expect(alignMoves(boxes, 'centerY')).toEqual([
      { id: 'a', dx: 0, dy: 40 },
      { id: 'b', dx: 0, dy: 20 },
      { id: 'c', dx: 0, dy: -25 }
    ])
  })

  it('aligns to a frame when one is given', () => {
    const frame = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    expect(alignMoves([box('a', 10, 10, 20, 20)], 'centerX', frame)).toEqual([
      { id: 'a', dx: 30, dy: 0 }
    ])
    expect(alignMoves([box('a', 10, 10, 20, 20)], 'centerY', frame)).toEqual([
      { id: 'a', dx: 0, dy: 30 }
    ])
  })

  it('returns nothing when everything is already aligned', () => {
    const aligned = [box('a', 5, 0, 10, 10), box('b', 5, 40, 30, 10)]
    expect(alignMoves(aligned, 'left')).toEqual([])
    expect(alignMoves([], 'left')).toEqual([])
  })
})

describe('distributeMoves', () => {
  it('equalizes horizontal gaps and keeps the outer shapes in place', () => {
    // Widths 10, 20, 10 between x 0 and 100: free space 60, two gaps of 30.
    const row = [box('a', 0, 0, 10, 10), box('b', 15, 50, 20, 10), box('c', 90, 5, 10, 10)]
    expect(distributeMoves(row, 'horizontal')).toEqual([{ id: 'b', dx: 25, dy: 0 }])
  })

  it('equalizes vertical gaps', () => {
    // Heights 10, 10, 30, 10 between y 0 and 110: free space 50, three gaps
    // of 50/3.
    const column = [
      box('a', 0, 0, 10, 10),
      box('b', 40, 12, 10, 10),
      box('c', 5, 30, 10, 30),
      box('d', 0, 100, 10, 10)
    ]
    const moves = distributeMoves(column, 'vertical')
    expect(moves.map((m) => m.id)).toEqual(['b', 'c'])
    expect(moves.every((m) => m.dx === 0)).toBe(true)
    const gap = 50 / 3
    expect(moves[0].dy).toBeCloseTo(10 + gap - 12)
    expect(moves[1].dy).toBeCloseTo(10 + gap + 10 + gap - 30)
  })

  it('orders shapes by position, not by the order they were selected', () => {
    const row = [box('c', 90, 0, 10, 10), box('b', 15, 0, 20, 10), box('a', 0, 0, 10, 10)]
    expect(distributeMoves(row, 'horizontal')).toEqual([{ id: 'b', dx: 25, dy: 0 }])
  })

  it('overlaps evenly when the shapes do not fit', () => {
    // Outer shapes 0..10 and 30..40 leave 20 for two 20-wide shapes: three
    // gaps of -20/3.
    const row = [
      box('a', 0, 0, 10, 10),
      box('b', 5, 0, 20, 10),
      box('c', 12, 0, 20, 10),
      box('d', 30, 0, 10, 10)
    ]
    const moves = distributeMoves(row, 'horizontal')
    const gap = -20 / 3
    expect(moves.find((m) => m.id === 'b')!.dx).toBeCloseTo(10 + gap - 5)
    expect(moves.find((m) => m.id === 'c')!.dx).toBeCloseTo(10 + gap + 20 + gap - 12)
  })

  it('needs at least three shapes and skips ones already in place', () => {
    expect(
      distributeMoves([box('a', 0, 0, 10, 10), box('b', 50, 0, 10, 10)], 'horizontal')
    ).toEqual([])
    const even = [box('a', 0, 0, 10, 10), box('b', 20, 0, 10, 10), box('c', 40, 0, 10, 10)]
    expect(distributeMoves(even, 'horizontal')).toEqual([])
  })
})
