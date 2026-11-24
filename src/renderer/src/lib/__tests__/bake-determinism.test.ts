// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import Module from 'manifold-3d'
import { buildBinCSG } from '../bin-csg-builder'
import type { CSGBinParams } from '../bin-csg-builder'
import { shapeToPocketVertices } from '../pocket-vertices'
import type { LayoutShape } from '@/layout-engine/types'

/**
 * The same project must always bake to the same solid. These build real bins with Manifold,
 * so a change in the library or in the builder that moves the result shows up here.
 */

let manifold: unknown

beforeAll(async () => {
  const module = await Module()
  module.setup()
  manifold = module
})

function binParams(overrides: Partial<CSGBinParams> = {}): CSGBinParams {
  return {
    widthUnits: 1,
    depthUnits: 1,
    heightUnits: 3,
    baseUnit: 42,
    unitHeight: 7,
    tolerance: 0.5,
    hasLip: true,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 },
    pockets: [],
    ...overrides
  }
}

const rectShape = {
  id: 'r',
  type: 'rect',
  x: 0,
  y: 0,
  width: 20,
  height: 12,
  rotation: 0,
  fill: '',
  stroke: '',
  strokeWidth: 1,
  groupId: 'bin'
} as LayoutShape

function rectPocket(rotation = 0): CSGBinParams['pockets'][number] {
  return {
    vertices: shapeToPocketVertices({ ...rectShape, rotation })!,
    depth: 8,
    clearance: 0,
    posX: 0,
    posY: 0,
    zTop: 21
  }
}

interface Measured {
  volume: number
  min: [number, number, number]
  max: [number, number, number]
}

/** Volume and bounding box of a closed mesh. */
function measure(mesh: { positions: Float32Array; indices: Uint32Array }): Measured {
  const { positions, indices } = mesh
  const corner = (i: number): [number, number, number] => [
    positions[i * 3],
    positions[i * 3 + 1],
    positions[i * 3 + 2]
  ]
  let volume = 0
  for (let t = 0; t < indices.length; t += 3) {
    const [ax, ay, az] = corner(indices[t])
    const [bx, by, bz] = corner(indices[t + 1])
    const [cx, cy, cz] = corner(indices[t + 2])
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[i + axis])
      max[axis] = Math.max(max[axis], positions[i + axis])
    }
  }
  return { volume, min, max }
}

function expectBox(actual: [number, number, number], expected: [number, number, number]): void {
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 3))
}

describe('baking a bin', () => {
  it('gives the same mesh every time for the same bin', () => {
    const params = binParams({ widthUnits: 2, pockets: [rectPocket()] })
    const first = buildBinCSG(params, manifold)
    const second = buildBinCSG(binParams({ widthUnits: 2, pockets: [rectPocket()] }), manifold)
    expect(second.positions).toEqual(first.positions)
    expect(second.indices).toEqual(first.indices)
    expect(second.normals).toEqual(first.normals)
    expect(second.solidVertices).toEqual(first.solidVertices)
  })

  it('does not depend on the bins baked before it', () => {
    const alone = buildBinCSG(binParams(), manifold)
    buildBinCSG(binParams({ widthUnits: 3, depthUnits: 2, hasLip: false }), manifold)
    const after = buildBinCSG(binParams(), manifold)
    expect(after.positions).toEqual(alone.positions)
    expect(after.indices).toEqual(alone.indices)
  })

  // Measured from a bake that was checked in a slicer. A change here means the solid changed:
  // update the numbers only when that is intended.
  it('makes a 1×1 bin with a lip of the expected size', () => {
    const { volume, min, max } = measure(buildBinCSG(binParams(), manifold))
    expect(volume).toBeCloseTo(34647.1, 0)
    expectBox(min, [-20.5, -20.5, 0])
    // 42 mm less the 0.5 mm tolerance on each side, and 3 units of 7 mm plus the lip.
    expectBox(max, [20.5, 20.5, 25.4])
  })

  it('makes a 2×1 bin without a lip of the expected size', () => {
    const { volume, min, max } = measure(
      buildBinCSG(binParams({ widthUnits: 2, hasLip: false }), manifold)
    )
    expect(volume).toBeCloseTo(67758.9, 0)
    expectBox(min, [-41.5, -20.5, 0])
    expectBox(max, [41.5, 20.5, 21])
  })

  it('removes exactly the pocket from the bin', () => {
    const solid = measure(buildBinCSG(binParams({ hasLip: false }), manifold))
    const cut = measure(
      buildBinCSG(binParams({ hasLip: false, pockets: [rectPocket()] }), manifold)
    )
    // 20 × 12 mm, 8 mm deep, no clearance.
    expect(solid.volume - cut.volume).toBeCloseTo(20 * 12 * 8, 1)
    expect(cut.min).toEqual(solid.min)
    expect(cut.max).toEqual(solid.max)
  })

  it('cuts a turned pocket the same size as a straight one', () => {
    const straight = measure(
      buildBinCSG(binParams({ hasLip: false, pockets: [rectPocket()] }), manifold)
    )
    const turned = measure(
      buildBinCSG(binParams({ hasLip: false, pockets: [rectPocket(30)] }), manifold)
    )
    expect(turned.volume).toBeCloseTo(straight.volume, 1)
  })
})
