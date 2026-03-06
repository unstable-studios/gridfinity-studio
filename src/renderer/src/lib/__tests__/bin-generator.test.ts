import { describe, it, expect } from 'vitest'
import { generateBinMesh } from '../bin-generator'
import type { BinParams } from '../bin-generator'

const defaultParams: BinParams = {
  widthUnits: 1,
  depthUnits: 1,
  heightUnits: 3,
  baseUnit: 42,
  unitHeight: 7,
  tolerance: 0.5,
  hasLip: true,
  hasDividers: false,
  magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
  screwHoles: { enabled: false, diameter: 3, depth: 6 }
}

describe('generateBinMesh', () => {
  it('1x1x3 bin produces valid mesh data', () => {
    const result = generateBinMesh(defaultParams)

    expect(result.positions).toBeDefined()
    expect(result.indices).toBeDefined()
    expect(result.normals).toBeDefined()
    expect(result.positions.length).toBeGreaterThan(0)
    expect(result.indices.length).toBeGreaterThan(0)
    expect(result.normals.length).toBeGreaterThan(0)
    expect(result.colors.length).toBe(result.positions.length)
  })

  it('2x2x4 bin with magnets produces more vertices than 1x1x3 with magnets', () => {
    const withMagnets = {
      ...defaultParams,
      magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 }
    }
    const small = generateBinMesh(withMagnets)
    const large = generateBinMesh({
      ...withMagnets,
      widthUnits: 2,
      depthUnits: 2,
      heightUnits: 4
    })

    // 2x2 = 4 grid cells × 4 corners = 16 holes vs 1x1 = 4 holes
    expect(large.positions.length).toBeGreaterThan(small.positions.length)
  })

  it('2x2 bin with dividers produces more vertices than without', () => {
    const noDividers = generateBinMesh({
      ...defaultParams,
      widthUnits: 2,
      depthUnits: 2,
      hasDividers: false
    })
    const withDividers = generateBinMesh({
      ...defaultParams,
      widthUnits: 2,
      depthUnits: 2,
      hasDividers: true
    })

    expect(withDividers.positions.length).toBeGreaterThan(noDividers.positions.length)
  })

  it('bin dimensions respect baseUnit (outer width ~ widthUnits * baseUnit - 2 * tolerance)', () => {
    const params: BinParams = { ...defaultParams, widthUnits: 2, depthUnits: 1 }
    const result = generateBinMesh(params)

    const expectedWidth = params.widthUnits * params.baseUnit - 2 * params.tolerance
    const expectedDepth = params.depthUnits * params.baseUnit - 2 * params.tolerance

    // Extract x-axis extent from positions
    const xValues: number[] = []
    const yValues: number[] = []
    for (let i = 0; i < result.positions.length; i += 3) {
      xValues.push(result.positions[i])
      yValues.push(result.positions[i + 1])
    }

    const actualWidth = Math.max(...xValues) - Math.min(...xValues)
    const actualDepth = Math.max(...yValues) - Math.min(...yValues)

    expect(actualWidth).toBeCloseTo(expectedWidth, 0)
    expect(actualDepth).toBeCloseTo(expectedDepth, 0)
  })

  it('all vertex positions are within expected bounding box', () => {
    const result = generateBinMesh(defaultParams)

    const maxExpectedXY = defaultParams.widthUnits * defaultParams.baseUnit
    const maxExpectedZ = defaultParams.heightUnits * defaultParams.unitHeight

    for (let i = 0; i < result.positions.length; i += 3) {
      const x = Math.abs(result.positions[i])
      const y = Math.abs(result.positions[i + 1])
      const z = result.positions[i + 2]

      // Allow generous margin for geometry details (lips, fillets, etc.)
      expect(x).toBeLessThanOrEqual(maxExpectedXY + 5)
      expect(y).toBeLessThanOrEqual(maxExpectedXY + 5)
      expect(z).toBeLessThanOrEqual(maxExpectedZ + 10)
    }
  })

  it('all indices are valid', () => {
    const result = generateBinMesh(defaultParams)
    const vertexCount = result.positions.length / 3

    for (const index of result.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })

  it('all normals are unit length', () => {
    const result = generateBinMesh(defaultParams)

    for (let i = 0; i < result.normals.length; i += 3) {
      const nx = result.normals[i]
      const ny = result.normals[i + 1]
      const nz = result.normals[i + 2]
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
      expect(length).toBeCloseTo(1, 4)
    }
  })

  it('face normals are consistent with vertex normals (no inside-out faces)', () => {
    const result = generateBinMesh({
      ...defaultParams,
      magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 }
    })
    const pos = result.positions
    const idx = result.indices
    const nrm = result.normals
    const col = result.colors

    // Track flipped faces by color
    const colorStats = new Map<string, { total: number; flipped: number }>()

    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i]
      const i1 = idx[i + 1]
      const i2 = idx[i + 2]

      // Identify color section from first vertex
      const cr = col[i0 * 3].toFixed(1)
      const cg = col[i0 * 3 + 1].toFixed(1)
      const cb = col[i0 * 3 + 2].toFixed(1)
      const colorKey = `${cr},${cg},${cb}`

      if (!colorStats.has(colorKey)) colorStats.set(colorKey, { total: 0, flipped: 0 })
      const stats = colorStats.get(colorKey)!
      stats.total++

      const ax = pos[i1 * 3] - pos[i0 * 3]
      const ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1]
      const az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2]
      const bx = pos[i2 * 3] - pos[i0 * 3]
      const by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1]
      const bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2]

      const fnx = ay * bz - az * by
      const fny = az * bx - ax * bz
      const fnz = ax * by - ay * bx

      const vnx = (nrm[i0 * 3] + nrm[i1 * 3] + nrm[i2 * 3]) / 3
      const vny = (nrm[i0 * 3 + 1] + nrm[i1 * 3 + 1] + nrm[i2 * 3 + 1]) / 3
      const vnz = (nrm[i0 * 3 + 2] + nrm[i1 * 3 + 2] + nrm[i2 * 3 + 2]) / 3

      const dot = fnx * vnx + fny * vny + fnz * vnz
      if (dot < 0) stats.flipped++
    }

    // Log per-color stats for debugging
    const colorNames: Record<string, string> = {
      '0.8,0.2,0.2': 'baseBottom',
      '1.0,0.5,0.0': 'baseChamfer',
      '1.0,0.8,0.0': 'baseTransition',
      '0.2,0.7,0.2': 'outerWalls',
      '0.2,0.5,0.8': 'innerWalls',
      '0.3,0.3,0.9': 'floor',
      '0.7,0.3,0.7': 'dividers',
      '0.9,0.2,0.5': 'lipProfile',
      '0.8,0.4,0.6': 'lipInner',
      '1.0,0.6,0.8': 'lipCap',
      '0.6,0.2,0.4': 'lipStep',
      '0.5,0.8,0.8': 'rim',
      '0.9,0.9,0.2': 'holeWalls',
      '0.7,0.7,0.1': 'holeCaps'
    }

    const problems: string[] = []
    for (const [key, stats] of colorStats) {
      const name = colorNames[key] ?? key
      if (stats.flipped > 0) {
        problems.push(`${name}: ${stats.flipped}/${stats.total} flipped`)
      }
    }

    expect(problems).toEqual([])
  })
})
