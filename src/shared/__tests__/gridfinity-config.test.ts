import { describe, it, expect } from 'vitest'

import {
  TOLERANCE_PRESETS,
  GRIDFINITY_PRESETS,
  DEFAULT_GRIDFINITY_CONFIG,
  createEmptyProject,
  computeDefaultPocketDepth
} from '../types/project'

describe('TOLERANCE_PRESETS', () => {
  it('has standard, loose, and tight keys', () => {
    expect(Object.keys(TOLERANCE_PRESETS)).toEqual(
      expect.arrayContaining(['standard', 'loose', 'tight'])
    )
    expect(Object.keys(TOLERANCE_PRESETS)).toHaveLength(3)
  })

  it('standard tolerance is 0.5', () => {
    expect(TOLERANCE_PRESETS.standard).toBe(0.5)
  })

  it('loose tolerance is 0.6', () => {
    expect(TOLERANCE_PRESETS.loose).toBe(0.6)
  })

  it('tight tolerance is 0.3', () => {
    expect(TOLERANCE_PRESETS.tight).toBe(0.3)
  })
})

describe('GRIDFINITY_PRESETS', () => {
  it('has standard, loose, and tight keys', () => {
    expect(Object.keys(GRIDFINITY_PRESETS)).toEqual(
      expect.arrayContaining(['standard', 'loose', 'tight'])
    )
    expect(Object.keys(GRIDFINITY_PRESETS)).toHaveLength(3)
  })

  describe.each(['standard', 'loose', 'tight'] as const)('%s preset', (preset) => {
    it('has baseUnit of 42', () => {
      expect(GRIDFINITY_PRESETS[preset].baseUnit).toBe(42)
    })

    it('has gridSpacing of 42', () => {
      expect(GRIDFINITY_PRESETS[preset].gridSpacing).toBe(42)
    })

    it('has unitHeight of 7', () => {
      expect(GRIDFINITY_PRESETS[preset].unitHeight).toBe(7)
    })

    it('tolerance matches TOLERANCE_PRESETS', () => {
      expect(GRIDFINITY_PRESETS[preset].tolerance).toBe(TOLERANCE_PRESETS[preset])
    })

    it('has valid magnetHoles config', () => {
      const { magnetHoles } = GRIDFINITY_PRESETS[preset]
      expect(magnetHoles).toEqual(
        expect.objectContaining({
          enabled: expect.any(Boolean),
          diameter: expect.any(Number),
          depth: expect.any(Number)
        })
      )
      expect(magnetHoles.diameter).toBeGreaterThan(0)
      expect(magnetHoles.depth).toBeGreaterThan(0)
    })

    it('has valid screwHoles config', () => {
      const { screwHoles } = GRIDFINITY_PRESETS[preset]
      expect(screwHoles).toEqual(
        expect.objectContaining({
          enabled: expect.any(Boolean),
          diameter: expect.any(Number),
          depth: expect.any(Number)
        })
      )
      expect(screwHoles.diameter).toBeGreaterThan(0)
      expect(screwHoles.depth).toBeGreaterThan(0)
    })
  })
})

describe('DEFAULT_GRIDFINITY_CONFIG', () => {
  it('equals GRIDFINITY_PRESETS.standard', () => {
    expect(DEFAULT_GRIDFINITY_CONFIG).toEqual(GRIDFINITY_PRESETS.standard)
  })

  it('is the same reference as GRIDFINITY_PRESETS.standard', () => {
    expect(DEFAULT_GRIDFINITY_CONFIG).toBe(GRIDFINITY_PRESETS.standard)
  })
})

describe('createEmptyProject', () => {
  it('uses the default gridfinity config', () => {
    const project = createEmptyProject()
    expect(project.gridfinity).toEqual(DEFAULT_GRIDFINITY_CONFIG)
  })

  it('creates a shallow copy of the config (not the same reference)', () => {
    const project = createEmptyProject()
    expect(project.gridfinity).not.toBe(DEFAULT_GRIDFINITY_CONFIG)
  })
})

describe('computeDefaultPocketDepth', () => {
  // Standard gridfinity: unitHeight=7, baseProfile=4.95, floor=1.0
  // 3u bin: 3*7 = 21, interior = 21 - 1.0 - 4.95 = 15.05 → rounded to 15.1

  it('computes interior depth for standard 3u bin', () => {
    expect(computeDefaultPocketDepth(3, 7)).toBe(15.1)
  })

  it('computes interior depth for 1u bin', () => {
    // 1*7 = 7, 7 - 1.0 - 4.95 = 1.05 → rounds to 1.0 (IEEE 754)
    expect(computeDefaultPocketDepth(1, 7)).toBe(1)
  })

  it('clamps to minimum 0.1 for very short bins', () => {
    // 0.5 * 7 = 3.5, 3.5 - 5.95 = -2.45 → clamped to 0.1
    expect(computeDefaultPocketDepth(0.5, 7)).toBe(0.1)
  })

  it('works with non-standard unit height', () => {
    // 3 * 10 = 30, 30 - 5.95 = 24.05 → 24.1
    expect(computeDefaultPocketDepth(3, 10)).toBe(24.1)
  })
})
