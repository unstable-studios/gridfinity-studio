// @vitest-environment node
import { describe, expect, it } from 'vitest'
import Module from 'manifold-3d'
import { buildBinCSG } from '../bin-csg-builder'
import type { CSGBinParams } from '../bin-csg-builder'

/**
 * The geometry worker keeps one Manifold module for as long as the app is open, and every
 * visit to Preview bakes every bin again. A bake must give back what it took.
 */

const params: CSGBinParams = {
  widthUnits: 2,
  depthUnits: 1,
  heightUnits: 3,
  baseUnit: 42,
  unitHeight: 7,
  tolerance: 0.5,
  hasLip: true,
  magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
  screwHoles: { enabled: true, diameter: 3, depth: 6 },
  pockets: [
    {
      vertices: new Float32Array([-10, -6, 10, -6, 10, 6, -10, 6]),
      depth: 8,
      clearance: 0.25,
      posX: 0,
      posY: 0,
      zTop: 21
    }
  ]
}

/** Without giving memory back, a module fails after about 300 bakes of a bin like this. */
const BAKES = 1200

describe('baking again and again on one module', () => {
  it('still bakes after many more bakes than leaked memory would allow', async () => {
    const module = await Module()
    module.setup()
    const first = buildBinCSG(params, module)

    let done = 1
    let last = first
    try {
      for (; done < BAKES; done++) last = buildBinCSG(params, module)
    } catch (err) {
      throw new Error(`bake ${done + 1} of ${BAKES} failed: ${String(err)}`, { cause: err })
    }

    expect(last.positions).toEqual(first.positions)
  }, 300_000)

  it('gives back what it took when a bake fails part-way', async () => {
    const module = await Module()
    module.setup()
    // A pocket that cannot be built: the feet, trunk and holes are made before it throws.
    const broken = {
      ...params,
      pockets: [{ ...params.pockets[0], vertices: null as unknown as Float32Array }]
    }

    for (let i = 0; i < BAKES; i++) expect(() => buildBinCSG(broken, module)).toThrow()

    // The module is still good for a real bake.
    expect(buildBinCSG(params, module).indices.length).toBeGreaterThan(0)
  }, 300_000)
})
