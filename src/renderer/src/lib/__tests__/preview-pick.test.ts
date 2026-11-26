import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_CONFIG } from '../theme-config'
import {
  CLICK_SLOP_PX,
  LEFT_OUT_OPACITY,
  glowIntensity,
  isClick,
  leftOutColor
} from '../preview-pick'

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
  it('takes the color out and keeps the brightness', () => {
    expect(leftOutColor('#000000')).toBe('#000000')
    expect(leftOutColor('#ffffff')).toBe('#ffffff')
    // Green counts for most of how bright a color looks, blue for least.
    expect(leftOutColor('#00ff00')).toBe('#b6b6b6')
    expect(leftOutColor('#0000ff')).toBe('#121212')
  })

  it('grays the default mesh colors of both themes', () => {
    expect(leftOutColor(DEFAULT_THEME_CONFIG.dark.meshColor)).toBe('#949494')
    expect(leftOutColor(DEFAULT_THEME_CONFIG.light.meshColor)).toBe('#7b7b7b')
  })

  it('reads colors without a leading # and in either case', () => {
    expect(leftOutColor('00FF00')).toBe('#b6b6b6')
  })

  it('gives the mesh color back when it is not #rrggbb', () => {
    expect(leftOutColor('rgb(0,0,0)')).toBe('rgb(0,0,0)')
    expect(leftOutColor('red')).toBe('red')
  })
})

describe('glowIntensity', () => {
  it('glows the same on every checked bin', () => {
    expect(glowIntensity({ checked: true, hovered: false })).toBeGreaterThan(0)
  })

  it('does not glow on a left-out bin', () => {
    expect(glowIntensity({ checked: false, hovered: false })).toBe(0)
  })

  it('glows more on the bin under the pointer', () => {
    for (const checked of [false, true]) {
      expect(glowIntensity({ checked, hovered: true })).toBeGreaterThan(
        glowIntensity({ checked, hovered: false })
      )
    }
  })

  it('keeps a left-out bin under the pointer dimmer than a checked bin at rest', () => {
    // A see-through bin shows only part of its glow.
    const shown = glowIntensity({ checked: false, hovered: true }) * LEFT_OUT_OPACITY
    expect(shown).toBeLessThan(glowIntensity({ checked: true, hovered: false }))
  })
})

describe('LEFT_OUT_OPACITY', () => {
  it('leaves a left-out bin partly see-through', () => {
    expect(LEFT_OUT_OPACITY).toBeGreaterThan(0)
    expect(LEFT_OUT_OPACITY).toBeLessThan(1)
  })
})
