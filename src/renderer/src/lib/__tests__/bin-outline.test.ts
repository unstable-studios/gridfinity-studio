import { describe, expect, it } from 'vitest'
import { roundedRectPolygon } from '../bin-csg-builder'
import { circleSegments } from '../curve-segments'

describe('roundedRectPolygon', () => {
  const outline = roundedRectPolygon(20.5, 20.5, 3.75)

  it('reaches the full width and depth', () => {
    expect(Math.max(...outline.map(([x]) => x))).toBe(20.5)
    expect(Math.min(...outline.map(([x]) => x))).toBe(-20.5)
    expect(Math.max(...outline.map(([, y]) => y))).toBe(20.5)
    expect(Math.min(...outline.map(([, y]) => y))).toBe(-20.5)
  })

  it('has a straight wall on each side, between the two corner centers', () => {
    const onRight = outline.filter(([x]) => x === 20.5).map(([, y]) => y)
    const onTop = outline.filter(([, y]) => y === 20.5).map(([x]) => x)
    const onLeft = outline.filter(([x]) => x === -20.5).map(([, y]) => y)
    const onBottom = outline.filter(([, y]) => y === -20.5).map(([x]) => x)

    for (const wall of [onRight, onTop, onLeft, onBottom]) {
      expect(wall.sort((a, b) => a - b)).toEqual([-16.75, 16.75])
    }
  })

  it('is the same on all four sides', () => {
    const key = ([x, y]: [number, number]): string => `${x.toFixed(9)},${y.toFixed(9)}`
    const points = new Set(outline.map(key))

    for (const [x, y] of outline) {
      expect(points.has(key([-x, y]))).toBe(true)
      expect(points.has(key([x, -y]))).toBe(true)
      expect(points.has(key([y, x]))).toBe(true)
    }
  })

  it('does not repeat a point', () => {
    expect(new Set(outline.map(([x, y]) => `${x},${y}`)).size).toBe(outline.length)
  })

  it('is a plain circle when the corners fill the sides', () => {
    const round = roundedRectPolygon(5, 5, 5)

    expect(new Set(round.map(([x, y]) => `${x},${y}`)).size).toBe(round.length)
    expect(round).toHaveLength(circleSegments(5))
  })
})
