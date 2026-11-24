// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { addBinSectionOpen, storeAddBinOpen, storedAddBinOpen } from '../add-bin-section'

describe('addBinSectionOpen', () => {
  it('is open in an empty project until the person says otherwise', () => {
    expect(addBinSectionOpen(null, 0)).toBe(true)
    expect(addBinSectionOpen(false, 0)).toBe(false)
  })

  it('is closed once there are bins, unless the person opened it', () => {
    expect(addBinSectionOpen(null, 3)).toBe(false)
    expect(addBinSectionOpen(true, 3)).toBe(true)
  })
})

describe('the stored choice', () => {
  beforeEach(() => localStorage.clear())

  it('is nothing until one is made', () => {
    expect(storedAddBinOpen()).toBeNull()
  })

  it('comes back as it was stored', () => {
    storeAddBinOpen(true)
    expect(storedAddBinOpen()).toBe(true)
    storeAddBinOpen(false)
    expect(storedAddBinOpen()).toBe(false)
  })

  it('is nothing when what is stored is not a choice', () => {
    localStorage.setItem('gridfinity-studio:add-bin-open', 'maybe')
    expect(storedAddBinOpen()).toBeNull()
  })
})
