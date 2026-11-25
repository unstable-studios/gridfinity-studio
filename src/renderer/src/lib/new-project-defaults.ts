/**
 * The Gridfinity settings a new project starts with. They are the app's own defaults until
 * the person saves a project's settings as their defaults, in Preferences. Kept on this
 * computer, not in any project file.
 */
import {
  DEFAULT_GRIDFINITY_CONFIG,
  createEmptyProject,
  newBinDefaults
} from '../../../shared/types/project'
import type { GridfinityConfig } from '../../../shared/types/project'
import { validateProject } from '../../../shared/validation/project-validator'

const STORAGE_KEY = 'gfstudio:newProjectDefaults'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Whether a project could start with `config`: checked the way a project file is. */
export function canBeNewProjectDefault(config: GridfinityConfig): boolean {
  return validateProject({ ...createEmptyProject(), gridfinity: config }).valid
}

/**
 * The saved defaults, or the app's own when none are saved or the saved ones are unsound.
 * `store` is the browser's storage unless given.
 */
export function loadNewProjectDefaults(store?: Store): GridfinityConfig {
  try {
    // Inside the `try`: where there is no browser storage, naming it throws.
    const raw = (store ?? localStorage).getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as GridfinityConfig
      // A damaged entry must not start a broken project.
      if (canBeNewProjectDefault(saved)) return saved
    }
  } catch {
    // No storage, unreadable storage or bad JSON: fall through to the app's defaults.
  }
  return structuredClone(DEFAULT_GRIDFINITY_CONFIG)
}

/** Keep `config` as what new projects start with. Settings a project could not use are not kept. */
export function saveNewProjectDefaults(config: GridfinityConfig, store?: Store): boolean {
  if (!canBeNewProjectDefault(config)) return false
  ;(store ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(config))
  return true
}

/** Whether `config` is what a new project would start with now. */
export function isNewProjectDefault(config: GridfinityConfig, store?: Store): boolean {
  const normal = (c: GridfinityConfig): string => {
    const newBin = newBinDefaults(c)
    return JSON.stringify({
      baseUnit: c.baseUnit,
      gridSpacing: c.gridSpacing,
      unitHeight: c.unitHeight,
      tolerance: c.tolerance,
      magnetHoles: [c.magnetHoles.enabled, c.magnetHoles.diameter, c.magnetHoles.depth],
      screwHoles: [c.screwHoles.enabled, c.screwHoles.diameter, c.screwHoles.depth],
      newBin: [newBin.heightUnits, newBin.hasLip]
    })
  }
  return normal(config) === normal(loadNewProjectDefaults(store))
}
