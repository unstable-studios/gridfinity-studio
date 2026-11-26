import { describe, expect, it } from 'vitest'
import {
  BED_SIDE_LIMITS,
  PRINTERS,
  bedSizeText,
  binFootprint,
  binTooBig,
  fitsBed,
  isUsableBed,
  loadBedChoice,
  saveBedChoice
} from '../print-bed'

function memoryStore(initial: Record<string, string> = {}): {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  keys: () => string[]
} {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    keys: () => [...items.keys()]
  }
}

const standard = { baseUnit: 42, tolerance: 0.25 }

describe('PRINTERS', () => {
  it('lists each printer once, with a bed that can be used', () => {
    expect(new Set(PRINTERS.map((printer) => printer.id)).size).toBe(PRINTERS.length)
    expect(new Set(PRINTERS.map((printer) => printer.name)).size).toBe(PRINTERS.length)
    for (const printer of PRINTERS) expect(isUsableBed(printer.bed), printer.name).toBe(true)
  })
})

describe('isUsableBed', () => {
  it('takes a bed with two sides inside the limits', () => {
    expect(isUsableBed({ width: 256, depth: 256 })).toBe(true)
    expect(isUsableBed({ width: BED_SIDE_LIMITS.min, depth: BED_SIDE_LIMITS.max })).toBe(true)
  })

  it('refuses a bed that is too small, too large, or not a size', () => {
    expect(isUsableBed({ width: BED_SIDE_LIMITS.min - 1, depth: 200 })).toBe(false)
    expect(isUsableBed({ width: 200, depth: BED_SIDE_LIMITS.max + 1 })).toBe(false)
    expect(isUsableBed({ width: NaN, depth: 200 })).toBe(false)
    expect(isUsableBed({ width: '200', depth: 200 })).toBe(false)
    expect(isUsableBed({ width: 200 })).toBe(false)
    expect(isUsableBed(null)).toBe(false)
    expect(isUsableBed('256x256')).toBe(false)
  })
})

describe('loadBedChoice and saveBedChoice', () => {
  const stored = (value: string): ReturnType<typeof memoryStore> =>
    memoryStore({ 'gfstudio:printBed': value })

  it('has no bed until one is saved', () => {
    expect(loadBedChoice(memoryStore())).toBeNull()
  })

  it('gives back the printer that was chosen, not another with the same bed', () => {
    // The A1 mini and the MINI+ both have a 180 mm bed.
    const store = memoryStore()
    saveBedChoice({ bed: { width: 180, depth: 180 }, printer: 'prusa-mini' }, store)
    expect(loadBedChoice(store)).toEqual({
      bed: { width: 180, depth: 180 },
      printer: 'prusa-mini'
    })
  })

  it('keeps a typed-in size as that, even one a listed printer has', () => {
    const store = memoryStore()
    saveBedChoice({ bed: { width: 220, depth: 220 }, printer: null }, store)
    expect(loadBedChoice(store)).toEqual({ bed: { width: 220, depth: 220 }, printer: null })
  })

  it('forgets the bed when none is saved over it', () => {
    const store = memoryStore()
    saveBedChoice({ bed: { width: 250, depth: 210 }, printer: 'prusa-mk4s' }, store)
    saveBedChoice(null, store)
    expect(loadBedChoice(store)).toBeNull()
    expect(store.keys()).toEqual([])
  })

  it('has no bed when what is stored is damaged or unsound', () => {
    expect(loadBedChoice(stored('not json'))).toBeNull()
    expect(loadBedChoice(stored('{"width":1,"depth":1}'))).toBeNull()
    expect(loadBedChoice(stored('[256,256]'))).toBeNull()
  })

  it('keeps the size and drops a printer that is not listed or has another bed', () => {
    const size = { bed: { width: 256, depth: 256 }, printer: null }
    expect(loadBedChoice(stored('{"width":256,"depth":256}'))).toEqual(size)
    expect(loadBedChoice(stored('{"width":256,"depth":256,"printer":"gone"}'))).toEqual(size)
    expect(loadBedChoice(stored('{"width":256,"depth":256,"printer":"prusa-xl"}'))).toEqual(size)
  })
})

describe('binFootprint', () => {
  it('is the grid size less the gap on each side', () => {
    expect(binFootprint({ widthUnits: 1, depthUnits: 1 }, standard)).toEqual({
      width: 41.5,
      depth: 41.5
    })
    expect(binFootprint({ widthUnits: 5, depthUnits: 2 }, standard)).toEqual({
      width: 209.5,
      depth: 83.5
    })
  })

  it('follows the base unit and tolerance of the project', () => {
    expect(
      binFootprint({ widthUnits: 2, depthUnits: 1 }, { baseUnit: 50, tolerance: 0.5 })
    ).toEqual({ width: 99, depth: 49 })
  })
})

describe('fitsBed', () => {
  const bed = { width: 250, depth: 210 }

  it('fits something no bigger than the bed', () => {
    expect(fitsBed({ width: 250, depth: 210 }, bed)).toBe(true)
    expect(fitsBed({ width: 100, depth: 100 }, bed)).toBe(true)
  })

  it('fits something that only fits turned a quarter turn', () => {
    expect(fitsBed({ width: 210, depth: 250 }, bed)).toBe(true)
    expect(fitsBed({ width: 100, depth: 240 }, bed)).toBe(true)
  })

  it('fits something long and narrow from corner to corner', () => {
    // The diagonal of a 180 mm square is 254.6 mm.
    const square = { width: 180, depth: 180 }
    expect(fitsBed({ width: 250, depth: 1 }, square)).toBe(true)
    expect(fitsBed({ width: 1, depth: 250 }, square)).toBe(true)
    expect(fitsBed({ width: 209.5, depth: 41.5 }, square)).toBe(true)
  })

  it('does not fit something too wide to lie at any angle', () => {
    const square = { width: 180, depth: 180 }
    // At 45 degrees a rectangle needs (long + short) / sqrt(2) of a square bed.
    expect(fitsBed({ width: 209.5, depth: 83.5 }, square)).toBe(false)
    expect(fitsBed({ width: 255, depth: 1 }, square)).toBe(false)
    expect(fitsBed({ width: 181, depth: 181 }, square)).toBe(false)
  })

  it('agrees with the 45 degree rule on a square bed', () => {
    const square = { width: 100, depth: 100 }
    // Longer than the bed, it fits a square exactly when long + short is at most 141.42.
    expect(fitsBed({ width: 120, depth: 21 }, square)).toBe(true)
    expect(fitsBed({ width: 120, depth: 22 }, square)).toBe(false)
  })
})

describe('binTooBig', () => {
  const miniBed = { width: 180, depth: 180 }

  it('is never too big when no bed is chosen', () => {
    expect(binTooBig({ widthUnits: 40, depthUnits: 40 }, standard, null)).toBe(false)
  })

  it('tells a bin that fits from one that does not', () => {
    // 4 units is 167.5 mm, 5 units is 209.5 mm.
    expect(binTooBig({ widthUnits: 4, depthUnits: 4 }, standard, miniBed)).toBe(false)
    expect(binTooBig({ widthUnits: 5, depthUnits: 2 }, standard, miniBed)).toBe(true)
    expect(binTooBig({ widthUnits: 2, depthUnits: 5 }, standard, miniBed)).toBe(true)
  })

  it('lets a long bin one unit wide lie across the corners', () => {
    expect(binTooBig({ widthUnits: 5, depthUnits: 1 }, standard, miniBed)).toBe(false)
    expect(binTooBig({ widthUnits: 7, depthUnits: 1 }, standard, miniBed)).toBe(true)
  })
})

describe('bedSizeText', () => {
  it('gives width, then depth, in mm', () => {
    expect(bedSizeText({ width: 250, depth: 210 })).toBe('250 × 210 mm')
  })
})
