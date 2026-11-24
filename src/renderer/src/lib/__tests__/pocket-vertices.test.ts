import { describe, it, expect } from 'vitest'
import { shapeToPocketVertices } from '../pocket-vertices'
import { circleSegments } from '../curve-segments'
import type { LayoutShape } from '@/layout-engine/types'

const base = {
  id: 's',
  x: 0,
  y: 0,
  rotation: 0,
  fill: '',
  stroke: '',
  strokeWidth: 1,
  groupId: null
}

function points(vertices: Float32Array | null): Array<[number, number]> {
  if (!vertices) throw new Error('no vertices')
  const out: Array<[number, number]> = []
  for (let i = 0; i < vertices.length; i += 2) out.push([vertices[i], vertices[i + 1]])
  return out
}

/** Twice the signed area: positive when the outline runs counter-clockwise in y-up. */
function signedArea2(outline: Array<[number, number]>): number {
  return outline.reduce((sum, [x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length]
    return sum + x * ny - nx * y
  }, 0)
}

function expectClose(actual: Array<[number, number]>, expected: Array<[number, number]>): void {
  expect(actual).toHaveLength(expected.length)
  actual.forEach(([x, y], i) => {
    expect(x).toBeCloseTo(expected[i][0], 4)
    expect(y).toBeCloseTo(expected[i][1], 4)
  })
}

describe('shapeToPocketVertices', () => {
  it('centers a rectangle on its own origin, counter-clockwise', () => {
    const rect = { ...base, type: 'rect', width: 20, height: 10 } as LayoutShape
    const outline = points(shapeToPocketVertices(rect))
    expectClose(outline, [
      [-10, -5],
      [10, -5],
      [10, 5],
      [-10, 5]
    ])
    expect(signedArea2(outline)).toBeGreaterThan(0)
  })

  it('makes an ellipse with both radii and enough segments for its size', () => {
    const ellipse = { ...base, type: 'circle', radiusX: 20, radiusY: 5 } as LayoutShape
    const outline = points(shapeToPocketVertices(ellipse))
    expect(outline).toHaveLength(circleSegments(20))
    expect(Math.max(...outline.map(([x]) => x))).toBeCloseTo(20, 4)
    expect(Math.max(...outline.map(([, y]) => y))).toBeCloseTo(5, 1)
    expect(signedArea2(outline)).toBeGreaterThan(0)
  })

  it('flips a polygon from screen y-down to y-up', () => {
    // A right triangle whose right angle is at the top left on screen.
    const polygon = {
      ...base,
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 6 }
      ]
    } as LayoutShape
    const outline = points(shapeToPocketVertices(polygon))
    // On screen the third point is below the first. In y-up it has the lowest y.
    expect(outline).toContainEqual([0, -6])
    expect(outline).toContainEqual([10, -0])
    expect(signedArea2(outline)).toBeGreaterThan(0)
  })

  it('gives a counter-clockwise outline whichever way the polygon was drawn', () => {
    const drawn = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    const oneWay = { ...base, type: 'polygon', points: drawn } as LayoutShape
    const otherWay = { ...base, type: 'polygon', points: [...drawn].reverse() } as LayoutShape
    expect(signedArea2(points(shapeToPocketVertices(oneWay)))).toBe(200)
    expect(signedArea2(points(shapeToPocketVertices(otherWay)))).toBe(200)
  })

  it('has no outline for a polygon with fewer than three points', () => {
    const line = {
      ...base,
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    } as LayoutShape
    expect(shapeToPocketVertices(line)).toBeNull()
  })

  it('turns a rectangle the way it is turned on the canvas', () => {
    // A quarter turn clockwise on screen: the wide rectangle becomes a tall one.
    const rect = { ...base, type: 'rect', width: 20, height: 10, rotation: 90 } as LayoutShape
    const outline = points(shapeToPocketVertices(rect))
    expect(Math.max(...outline.map(([x]) => x))).toBeCloseTo(5, 4)
    expect(Math.max(...outline.map(([, y]) => y))).toBeCloseTo(10, 4)
    expect(signedArea2(outline)).toBeCloseTo(400, 3)
  })

  it('turns a polygon clockwise as seen on screen', () => {
    // An arrow pointing right on screen. Turned 90° clockwise it points down the screen,
    // which is toward negative y once flipped to y-up.
    const arrow = {
      ...base,
      type: 'polygon',
      rotation: 90,
      points: [
        { x: 10, y: 0 },
        { x: -5, y: 3 },
        { x: -5, y: -3 }
      ]
    } as LayoutShape
    const outline = points(shapeToPocketVertices(arrow))
    const tip = outline.reduce((far, p) => (Math.hypot(...p) > Math.hypot(...far) ? p : far))
    expect(tip[0]).toBeCloseTo(0, 4)
    expect(tip[1]).toBeCloseTo(-10, 4)
    expect(signedArea2(outline)).toBeGreaterThan(0)
  })
})
