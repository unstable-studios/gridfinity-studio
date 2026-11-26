import { describe, expect, it } from 'vitest'
import { CLICK_SLOP_PX, isClick, leftOutColor } from '../preview-pick'

describe('isClick', () => {
  it('takes a press that did not move, or barely moved, as a click', () => {
    expect(isClick(0)).toBe(true)
    expect(isClick(CLICK_SLOP_PX)).toBe(true)
  })

  it('takes a press that moved further as a drag', () => {
    expect(isClick(CLICK_SLOP_PX + 1)).toBe(false)
    expect(isClick(120)).toBe(false)
  })
})

describe('leftOutColor', () => {
  it('fades the mesh color most of the way into the floor color', () => {
    expect(leftOutColor('#000000', '#ffffff')).toBe('#bfbfbf')
    expect(leftOutColor('#ffffff', '#000000')).toBe('#404040')
  })

  it('differs from both colors it is mixed from', () => {
    const color = leftOutColor('#4f9ef8', '#0c0f17')
    expect(color).not.toBe('#4f9ef8')
    expect(color).not.toBe('#0c0f17')
  })

  it('reads colors without a leading # and in either case', () => {
    expect(leftOutColor('000000', 'FFFFFF')).toBe('#bfbfbf')
  })

  it('gives the mesh color back when a color is not #rrggbb', () => {
    expect(leftOutColor('#4f9ef8', 'red')).toBe('#4f9ef8')
    expect(leftOutColor('rgb(0,0,0)', '#ffffff')).toBe('rgb(0,0,0)')
  })
})
