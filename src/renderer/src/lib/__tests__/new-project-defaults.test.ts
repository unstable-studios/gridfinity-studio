import { describe, it, expect } from 'vitest'
import {
  canBeNewProjectDefault,
  isNewProjectDefault,
  loadNewProjectDefaults,
  saveNewProjectDefaults
} from '../new-project-defaults'
import { DEFAULT_GRIDFINITY_CONFIG } from '../../../../shared/types/project'
import type { GridfinityConfig } from '../../../../shared/types/project'

function memoryStore(initial: Record<string, string> = {}): {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
} {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value)
  }
}

const mine: GridfinityConfig = {
  ...structuredClone(DEFAULT_GRIDFINITY_CONFIG),
  tolerance: 0.25,
  magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
  newBin: { heightUnits: 6, hasLip: false }
}

describe('new project defaults', () => {
  it('are the app defaults when nothing is saved', () => {
    expect(loadNewProjectDefaults(memoryStore())).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('hands out a copy, so a project cannot change the app defaults', () => {
    const loaded = loadNewProjectDefaults(memoryStore())
    loaded.magnetHoles.enabled = !loaded.magnetHoles.enabled
    expect(loadNewProjectDefaults(memoryStore())).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('are what was saved', () => {
    const store = memoryStore()
    saveNewProjectDefaults(mine, store)
    expect(loadNewProjectDefaults(store)).toEqual(mine)
  })

  it('do not keep settings a project could not use', () => {
    const store = memoryStore()
    const broken = { ...mine, baseUnit: 0 }
    expect(canBeNewProjectDefault(broken)).toBe(false)
    expect(saveNewProjectDefaults(broken, store)).toBe(false)
    expect(loadNewProjectDefaults(store)).toEqual(DEFAULT_GRIDFINITY_CONFIG)
    expect(saveNewProjectDefaults(mine, store)).toBe(true)
  })

  it('are the app defaults where there is no browser storage', () => {
    // The tests run without one, as the main process does.
    expect(typeof localStorage).toBe('undefined')
    expect(loadNewProjectDefaults()).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('ignore a saved entry that is not JSON', () => {
    const store = memoryStore({ 'gfstudio:newProjectDefaults': '{not json' })
    expect(loadNewProjectDefaults(store)).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('ignore a saved entry a project could not use', () => {
    const store = memoryStore({
      'gfstudio:newProjectDefaults': JSON.stringify({ ...mine, baseUnit: 0 })
    })
    expect(loadNewProjectDefaults(store)).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('ignore storage that cannot be read', () => {
    const broken = {
      ...memoryStore(),
      getItem: (): string | null => {
        throw new Error('denied')
      }
    }
    expect(loadNewProjectDefaults(broken)).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('know whether a project has the settings a new one would start with', () => {
    const store = memoryStore()
    expect(isNewProjectDefault(DEFAULT_GRIDFINITY_CONFIG, store)).toBe(true)
    expect(isNewProjectDefault(mine, store)).toBe(false)
    saveNewProjectDefaults(mine, store)
    expect(isNewProjectDefault(mine, store)).toBe(true)
    expect(isNewProjectDefault(DEFAULT_GRIDFINITY_CONFIG, store)).toBe(false)
  })

  it('treat settings with no new-bin defaults as having the usual ones', () => {
    const explicit = { ...DEFAULT_GRIDFINITY_CONFIG, newBin: { heightUnits: 3, hasLip: true } }
    expect(isNewProjectDefault(explicit, memoryStore())).toBe(true)
  })
})
