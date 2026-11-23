import { describe, it, expect } from 'vitest'
import { frameOffset } from '../position-frame'

// Lower-left corner at (100, 300), 84 wide and 42 tall: center (142, 279).
const bin = { x: 100, y: 300, width: 84, height: 42 }

describe('frameOffset', () => {
  it('is the bin center for a shape in a bin, in canvas coordinates', () => {
    expect(frameOffset({ groupId: 'bin' }, bin, 'canvas')).toEqual({ x: 142, y: 279 })
  })

  it('is zero for a shape in a bin, relative to the bin', () => {
    expect(frameOffset({ groupId: 'bin' }, bin, 'bin')).toEqual({ x: 0, y: 0 })
  })

  it('is zero for a shape outside every bin, whichever frame is asked for', () => {
    expect(frameOffset({ groupId: null }, undefined, 'canvas')).toEqual({ x: 0, y: 0 })
    expect(frameOffset({ groupId: null }, undefined, 'bin')).toEqual({ x: 0, y: 0 })
  })

  it('is zero when the bin cannot be found', () => {
    expect(frameOffset({ groupId: 'gone' }, undefined, 'canvas')).toEqual({ x: 0, y: 0 })
  })
})
