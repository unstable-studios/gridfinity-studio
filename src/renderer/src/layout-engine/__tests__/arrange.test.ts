import { describe, it, expect } from 'vitest'
import { alignMoves, boundsOf } from '../arrange'
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
