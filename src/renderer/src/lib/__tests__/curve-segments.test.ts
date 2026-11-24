import { describe, expect, it } from 'vitest'
import { circleSegments, CURVE_TOLERANCE } from '../curve-segments'

/** Distance from the middle of one segment to the circle. */
function deviation(radius: number, segments: number): number {
  return radius * (1 - Math.cos(Math.PI / segments))
}

describe('circleSegments', () => {
  it('keeps segments within the tolerance of the circle', () => {
    for (const radius of [0.25, 1.5, 3.25, 10, 25, 40]) {
      expect(deviation(radius, circleSegments(radius))).toBeLessThanOrEqual(CURVE_TOLERANCE)
    }
  })

  it('uses more segments for a larger circle', () => {
    expect(circleSegments(25)).toBeGreaterThan(circleSegments(10))
  })

  it('is always a multiple of 4', () => {
    for (const radius of [0, 0.25, 3.25, 7.3, 25, 500]) {
      expect(circleSegments(radius) % 4).toBe(0)
    }
  })

  it('has a floor for small circles and a ceiling for large ones', () => {
    expect(circleSegments(0.25)).toBe(64)
    expect(circleSegments(0)).toBe(64)
    expect(circleSegments(Number.NaN)).toBe(64)
    expect(circleSegments(5000)).toBe(360)
  })
})
