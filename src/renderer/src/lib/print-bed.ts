/**
 * The print bed: how big it is, and which bins do not fit on it. The bed belongs to the
 * person's printer, not to a project, so it is kept on this computer and not in any project
 * file. With no bed chosen nothing is checked.
 */
import type { GridfinityConfig } from '../../../shared/types/project'

/** The printable area of a bed, in mm. */
export interface PrintBed {
  width: number
  depth: number
}

export interface Printer {
  id: string
  name: string
  bed: PrintBed
}

/**
 * A few common printers, with the printable area each maker gives. Checked 2026-11-25:
 * - Bambu Lab: https://bambulab.com/hu/a1-mini/tech-specs (A1 mini), and
 *   https://wiki.polymaker.com/the-basics/3d-printers/popular-printers/bambu-lab (A1, P1, X1)
 * - Prusa: https://www.prusa3d.com/en/product/prusa-core-one-5/ (CORE One),
 *   https://www.prusa3d.com/product/original-prusa-xl-3d-printer/ (XL), and
 *   https://wiki.polymaker.com/the-basics/3d-printers/popular-printers/prusa (MK4S, MINI+)
 * - Creality: https://creality.com/compare/compare-ender-3-v3-series (Ender-3 V3), and
 *   https://all3dp.com/2/creality-k1-vs-k1-max-differences-comparison/ (K1 Max)
 */
export const PRINTERS: readonly Printer[] = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', bed: { width: 180, depth: 180 } },
  { id: 'bambu-a1-p1-x1', name: 'Bambu Lab A1, P1, X1', bed: { width: 256, depth: 256 } },
  { id: 'creality-ender-3-v3', name: 'Creality Ender-3 V3', bed: { width: 220, depth: 220 } },
  { id: 'creality-k1-max', name: 'Creality K1 Max', bed: { width: 300, depth: 300 } },
  { id: 'prusa-mini', name: 'Prusa MINI+', bed: { width: 180, depth: 180 } },
  { id: 'prusa-mk4s', name: 'Prusa MK4S', bed: { width: 250, depth: 210 } },
  { id: 'prusa-core-one', name: 'Prusa CORE One', bed: { width: 250, depth: 220 } },
  { id: 'prusa-xl', name: 'Prusa XL', bed: { width: 360, depth: 360 } }
]

/** The smallest and largest bed side that can be entered, in mm. */
export const BED_SIDE_LIMITS = { min: 50, max: 2000 }

/** Whether `bed` is a size a printer could have. */
export function isUsableBed(bed: unknown): bed is PrintBed {
  if (typeof bed !== 'object' || bed === null) return false
  const { width, depth } = bed as Record<string, unknown>
  return [width, depth].every(
    (side) =>
      typeof side === 'number' &&
      Number.isFinite(side) &&
      side >= BED_SIDE_LIMITS.min &&
      side <= BED_SIDE_LIMITS.max
  )
}

/** The listed printer with exactly this bed, if there is one. The first, when several match. */
export function printerWithBed(bed: PrintBed): Printer | null {
  return PRINTERS.find((p) => p.bed.width === bed.width && p.bed.depth === bed.depth) ?? null
}

const STORAGE_KEY = 'gfstudio:printBed'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The saved bed, or none when nothing is saved or what is saved is unsound. */
export function loadPrintBed(store?: Store): PrintBed | null {
  try {
    // Inside the `try`: where there is no browser storage, naming it throws.
    const raw = (store ?? localStorage).getItem(STORAGE_KEY)
    if (raw) {
      const saved: unknown = JSON.parse(raw)
      if (isUsableBed(saved)) return { width: saved.width, depth: saved.depth }
    }
  } catch {
    // No storage, unreadable storage or bad JSON: no bed.
  }
  return null
}

/** Keep `bed` as the person's print bed, or forget it when there is none. */
export function savePrintBed(bed: PrintBed | null, store?: Store): void {
  try {
    if (bed) (store ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(bed))
    else (store ?? localStorage).removeItem(STORAGE_KEY)
  } catch {
    // Without storage the choice lasts until the app closes.
  }
}

/** How much of the bed a bin covers, in mm: its grid size less the gap left on each side. */
export function binFootprint(
  bin: { widthUnits: number; depthUnits: number },
  gridfinity: Pick<GridfinityConfig, 'baseUnit' | 'tolerance'>
): PrintBed {
  return {
    width: bin.widthUnits * gridfinity.baseUnit - 2 * gridfinity.tolerance,
    depth: bin.depthUnits * gridfinity.baseUnit - 2 * gridfinity.tolerance
  }
}

/** Sizes are compared this loosely, in mm, so a bin exactly as wide as the bed fits. */
const EPSILON = 1e-6

/** Whether something `footprint` big fits on `bed`, lying either way round. */
export function fitsBed(footprint: PrintBed, bed: PrintBed): boolean {
  const fits = (width: number, depth: number): boolean =>
    width <= bed.width + EPSILON && depth <= bed.depth + EPSILON
  return fits(footprint.width, footprint.depth) || fits(footprint.depth, footprint.width)
}

/** Whether a bin is too big for `bed`. Never, when no bed is chosen. */
export function binTooBig(
  bin: { widthUnits: number; depthUnits: number },
  gridfinity: Pick<GridfinityConfig, 'baseUnit' | 'tolerance'>,
  bed: PrintBed | null
): boolean {
  return bed !== null && !fitsBed(binFootprint(bin, gridfinity), bed)
}

/** "256 × 256 mm" */
export function bedSizeText(bed: PrintBed): string {
  return `${bed.width} × ${bed.depth} mm`
}

/** What is said about a bin that does not fit, without a period: "larger than the print bed". */
export const TOO_BIG_TEXT = 'larger than the print bed'
