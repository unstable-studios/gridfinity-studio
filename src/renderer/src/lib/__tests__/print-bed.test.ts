import { describe, expect, it } from 'vitest'
import {
  BED_SIDE_LIMITS,
  PRINTERS,
  bedSizeText,
  binFootprint,
  binTooBig,
  fitsBed,
  isUsableBed,
  loadPrintBed,
  printerWithBed,
  savePrintBed
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

describe('printerWithBed', () => {
  it('finds the listed printer with that bed', () => {
    expect(printerWithBed({ width: 250, depth: 210 })?.id).toBe('prusa-mk4s')
  })

  it('finds none for a bed no listed printer has', () => {
    expect(printerWithBed({ width: 210, depth: 250 })).toBeNull()
    expect(printerWithBed({ width: 123, depth: 123 })).toBeNull()
  })
})

describe('loadPrintBed and savePrintBed', () => {
  it('has no bed until one is saved', () => {
    expect(loadPrintBed(memoryStore())).toBeNull()
  })

  it('gives back the bed that was saved', () => {
    const store = memoryStore()
    savePrintBed({ width: 250, depth: 210 }, store)
    expect(loadPrintBed(store)).toEqual({ width: 250, depth: 210 })
  })

  it('forgets the bed when none is saved over it', () => {
    const store = memoryStore()
    savePrintBed({ width: 250, depth: 210 }, store)
    savePrintBed(null, store)
    expect(loadPrintBed(store)).toBeNull()
    expect(store.keys()).toEqual([])
  })

  it('has no bed when what is stored is damaged or unsound', () => {
    expect(loadPrintBed(memoryStore({ 'gfstudio:printBed': 'not json' }))).toBeNull()
    expect(loadPrintBed(memoryStore({ 'gfstudio:printBed': '{"width":1,"depth":1}' }))).toBeNull()
    expect(loadPrintBed(memoryStore({ 'gfstudio:printBed': '[256,256]' }))).toBeNull()
  })

  it('keeps only the size from what is stored', () => {
    const store = memoryStore({ 'gfstudio:printBed': '{"width":256,"depth":256,"extra":true}' })
    expect(loadPrintBed(store)).toEqual({ width: 256, depth: 256 })
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

  it('does not fit something longer than the bed either way round', () => {
    expect(fitsBed({ width: 251, depth: 100 }, bed)).toBe(false)
    expect(fitsBed({ width: 220, depth: 220 }, bed)).toBe(false)
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
    expect(binTooBig({ widthUnits: 5, depthUnits: 1 }, standard, miniBed)).toBe(true)
    expect(binTooBig({ widthUnits: 1, depthUnits: 5 }, standard, miniBed)).toBe(true)
  })

  it('lets a bin lie either way round on a bed that is not square', () => {
    const bed = { width: 250, depth: 210 }
    // 6 units is 251.5 mm: too long for this bed. 5 units is 209.5 mm: fits its short side.
    expect(binTooBig({ widthUnits: 5, depthUnits: 5 }, standard, bed)).toBe(false)
    expect(binTooBig({ widthUnits: 6, depthUnits: 1 }, standard, bed)).toBe(true)
  })
})

describe('bedSizeText', () => {
  it('gives width, then depth, in mm', () => {
    expect(bedSizeText({ width: 250, depth: 210 })).toBe('250 × 210 mm')
  })
})
