import { describe, it, expect } from 'vitest'
import { shownPositionLimits, toShownPosition, toStoredPosition } from '../position-frame'
import type { PositionFrame } from '../position-frame'

// Stored coordinates have Y increasing downward. This bin's lower-left corner
// is stored at (100, 300); it is 84 wide and 42 tall, so it spans stored
// y 258..300 and its center is (142, 279).
const bin = { x: 100, y: 300, width: 84, height: 42 }

// A shape in the bin is stored relative to the bin's center.
const atCenter = { groupId: 'bin', x: 0, y: 0 }
const atLowerLeft = { groupId: 'bin', x: -42, y: 21 }
const atUpperRight = { groupId: 'bin', x: 42, y: -21 }

describe('toShownPosition', () => {
  it('measures from the bin lower-left corner, Y up, relative to the bin', () => {
    expect(toShownPosition(atLowerLeft, bin, 'bin')).toEqual({ x: 0, y: 0 })
    expect(toShownPosition(atCenter, bin, 'bin')).toEqual({ x: 42, y: 21 })
    expect(toShownPosition(atUpperRight, bin, 'bin')).toEqual({ x: 84, y: 42 })
  })

  it('measures from the canvas origin, Y up, on the canvas', () => {
    // Stored (100, 300) is 300 below the origin, so it is shown at y −300.
    expect(toShownPosition(atLowerLeft, bin, 'canvas')).toEqual({ x: 100, y: -300 })
    expect(toShownPosition(atCenter, bin, 'canvas')).toEqual({ x: 142, y: -279 })
    expect(toShownPosition(atUpperRight, bin, 'canvas')).toEqual({ x: 184, y: -258 })
  })

  it('shows a shape outside every bin on the canvas, whichever frame is asked for', () => {
    const loose = { groupId: null, x: 30, y: -12 }
    expect(toShownPosition(loose, undefined, 'canvas')).toEqual({ x: 30, y: 12 })
    expect(toShownPosition(loose, undefined, 'bin')).toEqual({ x: 30, y: 12 })
  })

  it('moving up on screen increases the shown Y', () => {
    const lower = toShownPosition({ groupId: 'bin', x: 0, y: 10 }, bin, 'bin')
    const higher = toShownPosition({ groupId: 'bin', x: 0, y: -10 }, bin, 'bin')
    expect(higher.y).toBeGreaterThan(lower.y)
  })
})

describe('toStoredPosition', () => {
  it('is the inverse of toShownPosition in both frames', () => {
    for (const frame of ['canvas', 'bin'] as PositionFrame[]) {
      for (const shape of [
        atCenter,
        atLowerLeft,
        atUpperRight,
        { groupId: 'bin', x: 7.5, y: -3 }
      ]) {
        const stored = toStoredPosition(toShownPosition(shape, bin, frame), shape, bin, frame)
        expect(stored.x).toBeCloseTo(shape.x)
        expect(stored.y).toBeCloseTo(shape.y)
      }
    }
  })

  it('converts only the coordinate it is given', () => {
    expect(toStoredPosition({ x: 42 }, atCenter, bin, 'bin')).toEqual({ x: 0 })
    expect(toStoredPosition({ y: 42 }, atCenter, bin, 'bin')).toEqual({ y: -21 })
  })

  it('flips Y for a shape outside every bin', () => {
    expect(toStoredPosition({ x: 5, y: 12 }, { groupId: null }, undefined, 'canvas')).toEqual({
      x: 5,
      y: -12
    })
  })
})

describe('shownPositionLimits', () => {
  it('keeps a bin-relative position inside the bin', () => {
    expect(shownPositionLimits(atCenter, bin, 'bin')).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 84, y: 42 }
    })
  })

  it('has no limit on the canvas or outside a bin', () => {
    expect(shownPositionLimits(atCenter, bin, 'canvas')).toBeNull()
    expect(shownPositionLimits({ groupId: null }, undefined, 'bin')).toBeNull()
  })
})
