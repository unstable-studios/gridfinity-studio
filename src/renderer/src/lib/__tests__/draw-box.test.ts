import { describe, expect, it } from 'vitest'
import { boxFromDrag } from '../draw-box'

const corner = { fromCenter: false, square: false }
const center = { fromCenter: true, square: false }

describe('boxFromDrag', () => {
  it('spans from the start corner to the pointer', () => {
    expect(boxFromDrag({ x: 10, y: 20 }, { x: 40, y: 30 }, corner)).toEqual({
      minX: 10,
      minY: 20,
      maxX: 40,
      maxY: 30
    })
  })

  it('works when dragging up and to the left', () => {
    expect(boxFromDrag({ x: 10, y: 20 }, { x: -5, y: 0 }, corner)).toEqual({
      minX: -5,
      minY: 0,
      maxX: 10,
      maxY: 20
    })
  })

  it('reaches the same distance both ways from the center', () => {
    expect(boxFromDrag({ x: 10, y: 20 }, { x: 40, y: 30 }, center)).toEqual({
      minX: -20,
      minY: 10,
      maxX: 40,
      maxY: 30
    })
  })

  it('makes a square from a corner, using the longer side', () => {
    const box = boxFromDrag({ x: 10, y: 20 }, { x: 40, y: 30 }, { ...corner, square: true })

    expect(box).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 50 })
  })

  it('keeps the start corner fixed for a square in every direction', () => {
    const square = { ...corner, square: true }
    const start = { x: 0, y: 0 }

    expect(boxFromDrag(start, { x: -30, y: 10 }, square)).toEqual({
      minX: -30,
      minY: 0,
      maxX: 0,
      maxY: 30
    })
    expect(boxFromDrag(start, { x: 10, y: -30 }, square)).toEqual({
      minX: 0,
      minY: -30,
      maxX: 30,
      maxY: 0
    })
    expect(boxFromDrag(start, { x: -10, y: -30 }, square)).toEqual({
      minX: -30,
      minY: -30,
      maxX: 0,
      maxY: 0
    })
  })

  it('makes a square around the center', () => {
    const box = boxFromDrag({ x: 10, y: 20 }, { x: 40, y: 30 }, { ...center, square: true })

    expect(box).toEqual({ minX: -20, minY: -10, maxX: 40, maxY: 50 })
  })

  it('is empty when the pointer has not moved', () => {
    for (const options of [corner, center]) {
      expect(boxFromDrag({ x: 5, y: 5 }, { x: 5, y: 5 }, options)).toEqual({
        minX: 5,
        minY: 5,
        maxX: 5,
        maxY: 5
      })
    }
  })
})
