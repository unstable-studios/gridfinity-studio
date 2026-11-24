// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import Module from 'manifold-3d'
import { buildBinCSG, pocketPoints } from '../bin-csg-builder'
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

  it('gives every vertex a normal of length 1', () => {
    const { normals } = buildBinCSG(binParams({ pockets: [rectPocket()] }), manifold)
    expect(normals.length).toBeGreaterThan(0)
    for (let i = 0; i < normals.length; i += 3) {
      expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 5)
    }
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
    expectBox(cut.min, solid.min)
    expectBox(cut.max, solid.max)
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

  /** How many triangles have no area, and how many edges are not shared by exactly two. */
  function flaws(mesh: {
    positions: Float32Array
    indices: Uint32Array
    solidVertices: Uint32Array
  }): { flat: number; openEdges: number } {
    const { positions: p, indices, solidVertices } = mesh
    let flat = 0
    const uses = new Map<string, number>()
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3]
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]
      const cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
      ]
      if (Math.hypot(...cross) / 2 < 1e-7) flat++
      // Vertices are split for shading. The solid's own vertices say which edges are shared.
      const solid = [0, 1, 2].map((corner) => solidVertices[indices[t + corner]])
      for (let e = 0; e < 3; e++) {
        const [from, to] = [solid[e], solid[(e + 1) % 3]]
        const key = from < to ? `${from}-${to}` : `${to}-${from}`
        uses.set(key, (uses.get(key) ?? 0) + 1)
      }
    }
    return { flat, openEdges: [...uses.values()].filter((count) => count !== 2).length }
  }

  it.each<[string, Partial<CSGBinParams>]>([
    ['1×1 with a lip', {}],
    [
      '1×1 without a lip or holes',
      { hasLip: false, magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 } }
    ],
    ['2×2 with a lip and holes', { widthUnits: 2, depthUnits: 2 }],
    ['3×2 without a lip', { widthUnits: 3, depthUnits: 2, hasLip: false }],
    [
      '2×1 with screw holes',
      { widthUnits: 2, screwHoles: { enabled: true, diameter: 3, depth: 6 } }
    ],
    ['1×1 with a pocket', { pockets: [rectPocket()] }],
    ['1×1 with a turned pocket', { pockets: [rectPocket(30)] }],
    ['2×1 at the tight tolerance', { widthUnits: 2, tolerance: 0.3, hasLip: false }],
    ['2×1 at the tight tolerance, with a lip', { widthUnits: 2, tolerance: 0.3 }],
    ['5×5 at the tight tolerance', { widthUnits: 5, depthUnits: 5, tolerance: 0.3, hasLip: false }],
    ['3×2 on a 37.3 mm grid', { widthUnits: 3, depthUnits: 2, baseUnit: 37.3, tolerance: 0.15 }],
    // 20.5 less the 2.85 mm the groove is in from the wall: the pocket's side is the groove's.
    [
      '1×1 with a pocket wall on the lip groove wall',
      { pockets: [{ ...rectPocket(), posX: 7.65 }] }
    ]
  ])('leaves no flat triangles and no open edges: %s', (_name, overrides) => {
    expect(flaws(buildBinCSG(binParams(overrides), manifold))).toEqual({ flat: 0, openEdges: 0 })
  })

  it('keeps a low bin with a lip open at the top', () => {
    // 5 mm units: the bin is lower than its 7 mm base, and the lip starts at 5 mm.
    const low = buildBinCSG(binParams({ unitHeight: 5, heightUnits: 1 }), manifold)
    const { max, volume } = measure(low)
    expect(max[2]).toBeCloseTo(9.4, 4)
    // A cap over the groove would add most of 4.4 mm of solid bin.
    expect(volume).toBeLessThan(8500)
    expect(flaws(low)).toEqual({ flat: 0, openEdges: 0 })
  })

  it('makes a bin one unit high exactly one unit high', () => {
    const { max } = measure(buildBinCSG(binParams({ heightUnits: 1, hasLip: false }), manifold))
    expect(max[2]).toBeCloseTo(7, 6)
  })
})

describe('a pocket with nothing to cut', () => {
  const pocket = (
    vertices: number[],
    more: Partial<CSGBinParams['pockets'][number]> = {}
  ): CSGBinParams['pockets'][number] => ({
    vertices: new Float32Array(vertices),
    depth: 8,
    clearance: 0,
    posX: 0,
    posY: 0,
    zTop: 21,
    ...more
  })
  const plain = binParams({ hasLip: false })
  const square = [-5, -5, 5, -5, 5, 5, -5, 5]
  /** Volume a bin loses to its pockets. */
  const cutVolume = (pockets: CSGBinParams['pockets']): number =>
    measure(buildBinCSG(plain, manifold)).volume -
    measure(buildBinCSG({ ...plain, pockets }, manifold)).volume

  it.each<[string, CSGBinParams['pockets'][number]]>([
    ['three points in a line', pocket([-5, 0, 0, 0, 5, 0])],
    ['three points in a slanted line', pocket([-5, -5, 0, 0, 5, 5])],
    ['every point in one place', pocket([0, 0, 0, 0, 0, 0, 0, 0])],
    ['a rectangle with no height', pocket([-5, 0, 5, 0, 5, 0, -5, 0])],
    ['two points', pocket([-5, 0, 5, 0])],
    ['a point that is not a number', pocket([NaN, 0, 5, 0, 5, 5])],
    ['no depth', pocket(square, { depth: 0 })],
    ['a depth below zero', pocket(square, { depth: -3 })],
    ['a depth that is not a number', pocket(square, { depth: NaN })],
    ['a top that is not a number', pocket(square, { zTop: NaN })]
  ])('leaves the bin whole and says which pocket: %s', (_name, bad) => {
    const whole = buildBinCSG(plain, manifold)
    for (const clearance of [0, 0.25]) {
      const baked = buildBinCSG({ ...plain, pockets: [{ ...bad, clearance }] }, manifold)
      // The bin used to bake to nothing at all.
      expect(baked.positions).toEqual(whole.positions)
      expect(baked.skippedPockets).toEqual([0])
    }
    expect(whole.skippedPockets).toEqual([])
  })

  it('still cuts the good pockets beside one with no area', () => {
    const mixed = buildBinCSG(
      { ...plain, pockets: [pocket(square), pocket([-5, 0, 0, 0, 5, 0]), pocket(square)] },
      manifold
    )
    expect(measure(buildBinCSG(plain, manifold)).volume - measure(mixed).volume).toBeCloseTo(
      cutVolume([pocket(square)]),
      3
    )
    expect(mixed.skippedPockets).toEqual([1])
  })

  it('cuts an outline that runs clockwise the same as one that does not', () => {
    const clockwise = [-5, -5, -5, 5, 5, 5, 5, -5]
    // A clockwise outline used to remove the whole bin.
    expect(cutVolume([pocket(clockwise)])).toBeCloseTo(10 * 10 * 8, 2)
    expect(cutVolume([pocket(square)])).toBeCloseTo(10 * 10 * 8, 2)
  })

  it('cuts everything an outline that crosses itself goes around', () => {
    // A bow tie: two triangles of 25 mm² each, wound opposite ways.
    const bowTie = [-5, -5, 5, 5, 5, -5, -5, 5]
    const baked = buildBinCSG({ ...plain, pockets: [pocket(bowTie)] }, manifold)
    expect(cutVolume([pocket(bowTie)])).toBeCloseTo(50 * 8, 2)
    expect(baked.skippedPockets).toEqual([])
  })

  it('fails, and does not pass for a bin, when the pockets leave nothing', () => {
    // Bigger than the bin and as deep as it is tall.
    const everything = pocket([-50, -50, 50, -50, 50, 50, -50, 50], { depth: 21 })
    expect(() => buildBinCSG({ ...plain, pockets: [everything] }, manifold)).toThrow(
      /Nothing is left/
    )
  })
})

describe('pocketPoints', () => {
  const spec = (vertices: number[], posX = 0, posY = 0): CSGBinParams['pockets'][number] => ({
    vertices: new Float32Array(vertices),
    depth: 5,
    clearance: 0,
    posX,
    posY,
    zTop: 21
  })

  it('moves the points to where the pocket is in the bin', () => {
    expect(pocketPoints(spec([0, 0, 2, 0, 0, 2], 10, -4))).toEqual([
      [10, -4],
      [12, -4],
      [10, -2]
    ])
  })

  it('has nothing for too few points or a point that is not a number', () => {
    expect(pocketPoints(spec([0, 0, 1, 0]))).toBeNull()
    expect(pocketPoints(spec([]))).toBeNull()
    expect(pocketPoints(spec([0, 0, Infinity, 0, 0, 1]))).toBeNull()
  })
})
