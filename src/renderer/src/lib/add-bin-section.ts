/**
 * Whether the sidebar's Add bin section is open.
 *
 * It starts open only while the project has no bins, when its size grid is the obvious way
 * to begin. After that it stays out of the way unless the person opened it or used it, and
 * that choice is kept between sessions.
 */

const STORAGE_KEY = 'gridfinity-studio:add-bin-open'

/** What the person last chose, or null if they never chose. */
export function storedAddBinOpen(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'true' ? true : raw === 'false' ? false : null
  } catch {
    return null
  }
}

export function storeAddBinOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(open))
  } catch {
    // Storage can be unavailable. The section still opens and closes for this session.
  }
}

/** Open when the person chose so, or, with no choice made, while there are no bins. */
export function addBinSectionOpen(chosen: boolean | null, binCount: number): boolean {
  return chosen ?? binCount === 0
}
