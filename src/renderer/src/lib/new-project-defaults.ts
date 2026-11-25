/**
 * The Gridfinity settings a new project starts with. They are the app's own defaults until
 * the person saves a project's settings as their defaults, in Preferences. Kept on this
 * computer, not in any project file.
 */
import { DEFAULT_GRIDFINITY_CONFIG, createEmptyProject } from '../../../shared/types/project'
import type { GridfinityConfig } from '../../../shared/types/project'
import { validateProject } from '../../../shared/validation/project-validator'

const STORAGE_KEY = 'gfstudio:newProjectDefaults'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The saved defaults, or the app's own when none are saved or the saved ones are unsound. */
export function loadNewProjectDefaults(store: Store = localStorage): GridfinityConfig {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as GridfinityConfig
      // Checked the way a project file is, so a damaged entry cannot start a broken project.
      const project = { ...createEmptyProject(), gridfinity: saved }
      if (validateProject(project).valid) return saved
    }
  } catch {
    // Unreadable storage or JSON: fall through to the app's defaults.
  }
  return structuredClone(DEFAULT_GRIDFINITY_CONFIG)
}

export function saveNewProjectDefaults(
  config: GridfinityConfig,
  store: Store = localStorage
): void {
  store.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** Go back to the app's own defaults. */
export function clearNewProjectDefaults(store: Store = localStorage): void {
  store.removeItem(STORAGE_KEY)
}

/** Whether `config` is what a new project would start with now. */
export function isNewProjectDefault(
  config: GridfinityConfig,
  store: Store = localStorage
): boolean {
  const normal = (c: GridfinityConfig): string =>
    JSON.stringify({
      baseUnit: c.baseUnit,
      gridSpacing: c.gridSpacing,
      unitHeight: c.unitHeight,
      tolerance: c.tolerance,
      magnetHoles: [c.magnetHoles.enabled, c.magnetHoles.diameter, c.magnetHoles.depth],
      screwHoles: [c.screwHoles.enabled, c.screwHoles.diameter, c.screwHoles.depth],
      newBin: [c.newBin?.heightUnits ?? 3, c.newBin?.hasLip ?? true]
    })
  return normal(config) === normal(loadNewProjectDefaults(store))
}
