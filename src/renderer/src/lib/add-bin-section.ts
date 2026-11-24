/**
 * Whether the sidebar's Add bin section is open.
 *
 * It starts open only while the project has no bins, when its size grid is the obvious way
 * to begin. After that it stays out of the way unless the person opens it. Opening or
 * closing it by its title is a choice, kept between sessions. Adding a bin from the grid is
 * not: it keeps the grid there for the next bin, until the app is closed.
 */

const STORAGE_KEY = 'gridfinity-studio:add-bin-open'

export interface AddBinSection {
  /** What the person last chose by the title, or null if they never chose. */
  chosen: boolean | null
  /** Whether a bin has been added from the grid since the app was opened. */
  used: boolean
}

function readChoice(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'true' ? true : raw === 'false' ? false : null
  } catch {
    return null
  }
}

/**
 * Held here as well as in storage: the sidebar is rebuilt on every switch between Design and
 * Preview, and must come back as it was even when storage cannot be written.
 */
let section: AddBinSection | null = null

export function addBinSection(): AddBinSection {
  section ??= { chosen: readChoice(), used: false }
  return section
}

/** The person opened or closed the section by its title. */
export function chooseAddBinOpen(open: boolean): AddBinSection {
  section = { ...addBinSection(), chosen: open }
  try {
    localStorage.setItem(STORAGE_KEY, String(open))
  } catch {
    // Storage can be unavailable. The choice still holds until the app is closed.
  }
  return section
}

/** A bin was added from the grid: keep the grid there for the next one. */
export function noteAddBinUsed(): AddBinSection {
  section = { ...addBinSection(), used: true }
  return section
}

/**
 * Open when the person chose so. With no choice made, open while there are no bins, or
 * while they are adding bins from it.
 */
export function addBinSectionOpen({ chosen, used }: AddBinSection, binCount: number): boolean {
  return chosen ?? (used || binCount === 0)
}
