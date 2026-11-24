// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Module = typeof import('../add-bin-section')

/** The module as it is when the app starts: nothing read from storage yet. */
async function freshModule(): Promise<Module> {
  vi.resetModules()
  return import('../add-bin-section')
}

beforeEach(() => localStorage.clear())

describe('addBinSectionOpen', () => {
  it('is open in an empty project until the person says otherwise', async () => {
    const { addBinSectionOpen } = await freshModule()
    expect(addBinSectionOpen({ chosen: null, used: false }, 0)).toBe(true)
    expect(addBinSectionOpen({ chosen: false, used: false }, 0)).toBe(false)
  })

  it('is closed once there are bins, unless the person opened it', async () => {
    const { addBinSectionOpen } = await freshModule()
    expect(addBinSectionOpen({ chosen: null, used: false }, 3)).toBe(false)
    expect(addBinSectionOpen({ chosen: true, used: false }, 3)).toBe(true)
  })

  it('stays open while bins are being added from it', async () => {
    const { addBinSectionOpen } = await freshModule()
    expect(addBinSectionOpen({ chosen: null, used: true }, 3)).toBe(true)
    // Closing it by its title still closes it.
    expect(addBinSectionOpen({ chosen: false, used: true }, 3)).toBe(false)
  })
})

describe('what is kept', () => {
  it('starts with no choice and nothing used', async () => {
    const { addBinSection } = await freshModule()
    expect(addBinSection()).toEqual({ chosen: null, used: false })
  })

  it('keeps a choice made by the title for the next session', async () => {
    const first = await freshModule()
    first.chooseAddBinOpen(false)
    const next = await freshModule()
    expect(next.addBinSection()).toEqual({ chosen: false, used: false })
  })

  it('does not keep "used" for the next session: a 30-bin project opens with it closed', async () => {
    const first = await freshModule()
    expect(first.noteAddBinUsed()).toEqual({ chosen: null, used: true })
    // Still used after the sidebar is rebuilt in the same session.
    expect(first.addBinSection().used).toBe(true)
    const next = await freshModule()
    expect(next.addBinSection()).toEqual({ chosen: null, used: false })
    expect(next.addBinSectionOpen(next.addBinSection(), 30)).toBe(false)
  })

  it('holds a choice for the session when storage cannot be written', async () => {
    const { chooseAddBinOpen, addBinSection } = await freshModule()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    chooseAddBinOpen(true)
    expect(addBinSection().chosen).toBe(true)
    setItem.mockRestore()
  })

  it('reads anything else in storage as no choice', async () => {
    localStorage.setItem('gridfinity-studio:add-bin-open', 'maybe')
    const { addBinSection } = await freshModule()
    expect(addBinSection().chosen).toBeNull()
  })
})
