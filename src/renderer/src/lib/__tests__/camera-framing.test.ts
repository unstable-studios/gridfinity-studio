import { describe, it, expect } from 'vitest'
import { boundsKey, frameBounds } from '../camera-framing'
import type { Bounds3 } from '../camera-framing'

const FOV = 50

/** Half-angle the bounding sphere subtends from the camera. */
function sphereHalfAngle(bounds: Bounds3, distance: number): number {
  const radius =
    Math.hypot(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2]
    ) / 2
  return Math.asin(radius / distance)
}

describe('frameBounds', () => {
  const offCenter: Bounds3 = { min: [200, 0, -400], max: [284, 21, -316] }

  it('targets the center of the box, wherever it sits', () => {
    const frame = frameBounds(offCenter, FOV, 1.5)
    expect(frame.target).toEqual([242, 10.5, -358])
  })

  it('puts the camera at the reported distance from the target', () => {
    const frame = frameBounds(offCenter, FOV, 1.5)
    const d = Math.hypot(
      frame.position[0] - frame.target[0],
      frame.position[1] - frame.target[1],
      frame.position[2] - frame.target[2]
    )
    expect(d).toBeCloseTo(frame.distance, 6)
    expect(frame.position[1]).toBeGreaterThan(frame.target[1])
  })

  it.each([
    ['wide view', 1.8],
    ['square view', 1],
    ['narrow view', 0.5]
  ])('fits the whole box inside the field of view (%s)', (_name, aspect) => {
    const frame = frameBounds(offCenter, FOV, aspect)
    const vertical = (FOV * Math.PI) / 180
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect)
    const half = sphereHalfAngle(offCenter, frame.distance)
    expect(half).toBeLessThan(vertical / 2)
    expect(half).toBeLessThan(horizontal / 2)
  })

  it('moves back for a larger layout', () => {
    const small = frameBounds({ min: [0, 0, 0], max: [42, 21, 42] }, FOV, 1.5)
    const large = frameBounds({ min: [0, 0, 0], max: [252, 42, 252] }, FOV, 1.5)
    expect(large.distance).toBeGreaterThan(small.distance * 3)
  })
})

describe('boundsKey', () => {
  it('is equal for equal boxes and differs when a bin moves', () => {
    const a: Bounds3 = { min: [0, 0, 0], max: [84, 21, 84] }
    expect(boundsKey(a)).toBe(boundsKey({ min: [0, 0, 0], max: [84, 21, 84] }))
    expect(boundsKey(a)).not.toBe(boundsKey({ min: [42, 0, 0], max: [126, 21, 84] }))
  })
})
