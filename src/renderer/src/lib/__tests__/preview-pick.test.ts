import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_CONFIG } from '../theme-config'
import { CLICK_SLOP_PX, glowIntensity, isClick, leftOutColor } from '../preview-pick'

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
  it('fades the mesh color most of the way into a light floor', () => {
    expect(leftOutColor('#000000', '#ffffff')).toBe('#bfbfbf')
  })

  it('fades less into a dark floor, so the bin can still be made out', () => {
    expect(leftOutColor('#ffffff', '#000000')).toBe('#737373')
  })

  it('fades the default themes by the amount each was tuned for', () => {
    const { dark, light } = DEFAULT_THEME_CONFIG
    expect(leftOutColor(dark.meshColor, dark.reviewFloor)).toBe('#2a4f7c')
    expect(leftOutColor(light.meshColor, light.reviewFloor)).toBe('#aec2e3')
  })

  it('counts a floor as dark below a quarter of full brightness', () => {
    expect(leftOutColor('#ffffff', '#3f3f3f')).toBe('#959595')
    expect(leftOutColor('#ffffff', '#404040')).toBe('#707070')
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

describe('glowIntensity', () => {
  const resting = { hovered: false }
  const hovered = { hovered: true }

  it('does not glow while every bin is checked', () => {
    expect(glowIntensity({ checked: true, choosing: false, ...resting })).toBe(0)
  })

  it('glows on a checked bin while some bin is left out', () => {
    expect(glowIntensity({ checked: true, choosing: true, ...resting })).toBeGreaterThan(0)
    expect(glowIntensity({ checked: false, choosing: true, ...resting })).toBe(0)
  })

  it('glows more on the bin under the pointer', () => {
    for (const choosing of [false, true]) {
      for (const checked of [false, true]) {
        expect(glowIntensity({ checked, choosing, ...hovered })).toBeGreaterThan(
          glowIntensity({ checked, choosing, ...resting })
        )
      }
    }
  })

  it('keeps a left-out bin under the pointer dimmer than a checked bin at rest', () => {
    expect(glowIntensity({ checked: false, choosing: true, ...hovered })).toBeLessThan(
      glowIntensity({ checked: true, choosing: true, ...resting })
    )
  })
})
