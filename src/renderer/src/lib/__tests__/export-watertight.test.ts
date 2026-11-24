// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import Module from 'manifold-3d'
import { buildBinCSG } from '../bin-csg-builder'
import type { CSGBinParams } from '../bin-csg-builder'
import { circleSegments, CURVE_TOLERANCE } from '../curve-segments'
import { build3MFArrayBuffer } from '../export-baked'
import { shapeToPocketVertices } from '../pocket-vertices'
import type { LayoutShape } from '@/layout-engine/types'
import type { BakeResult } from '@/hooks/useProject'

/**
 * Builds real bins with Manifold and reads the exported 3MF back the way a slicer does:
 * triangles that share a vertex index are joined, and nothing else is.
 */

let manifold: unknown

beforeAll(async () => {
  const module = await Module()
  module.setup()
  manifold = module
})

function binParams(overrides: Partial<CSGBinParams> = {}): CSGBinParams {
  return {
    widthUnits: 2,
    depthUnits: 2,
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

function bake(params: CSGBinParams): BakeResult {
  return { mesh: { ...buildBinCSG(params, manifold), colors: new Float32Array(0) } } as BakeResult
}

interface ReadMesh {
  vertices: Array<[number, number, number]>
  triangles: Array<[number, number, number]>
}

async function readMesh(buffer: ArrayBuffer): Promise<ReadMesh> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('3D/3dmodel.model')!.async('string')
  const vertices = [...xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map(
    (m): [number, number, number] => [Number(m[1]), Number(m[2]), Number(m[3])]
  )
  const triangles = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].map(
    (m): [number, number, number] => [Number(m[1]), Number(m[2]), Number(m[3])]
  )
  return { vertices, triangles }
}

/** Edges that are not used exactly once in each direction. A closed solid has none. */
function openEdges({ triangles }: ReadMesh): number {
  const uses = new Map<string, number>()
  for (const [a, b, c] of triangles) {
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a]
    ]) {
      uses.set(`${from}>${to}`, (uses.get(`${from}>${to}`) ?? 0) + 1)
    }
  }
  let open = 0
  for (const [edge, count] of uses) {
    const [from, to] = edge.split('>')
    if (count !== 1 || uses.get(`${to}>${from}`) !== 1) open++
  }
  return open
}

/** Number of separate connected pieces. */
function shells({ vertices, triangles }: ReadMesh): number {
  const parent = vertices.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (const [a, b, c] of triangles) {
    parent[find(a)] = find(b)
    parent[find(b)] = find(c)
  }
  return new Set(triangles.map(([a]) => find(a))).size
}

function volume({ vertices, triangles }: ReadMesh): number {
  let sum = 0
  for (const [a, b, c] of triangles) {
    const [ax, ay, az] = vertices[a]
    const [bx, by, bz] = vertices[b]
    const [cx, cy, cz] = vertices[c]
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return sum / 6
}

describe('3MF export of a baked bin', () => {
  it('is one closed solid for a bin with magnet holes', async () => {
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(binParams())]]), 'bin')
    const mesh = await readMesh(buffer!)

    expect(mesh.triangles.length).toBeGreaterThan(0)
    expect(openEdges(mesh)).toBe(0)
    expect(shells(mesh)).toBe(1)
    expect(volume(mesh)).toBeGreaterThan(0)
  })

  it('compresses the model', async () => {
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(binParams())]]), 'bin')
    const zip = await JSZip.loadAsync(buffer!)
    const xml = await zip.file('3D/3dmodel.model')!.async('string')

    expect(buffer!.byteLength).toBeLessThan(xml.length / 2)
  })

  it('has no repeated vertices or collapsed triangles', async () => {
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(binParams())]]), 'bin')
    const mesh = await readMesh(buffer!)

    expect(new Set(mesh.vertices.map((v) => v.join(','))).size).toBe(mesh.vertices.length)
    for (const [a, b, c] of mesh.triangles) {
      expect(a !== b && b !== c && c !== a).toBe(true)
    }
  })

  it('stays closed with screw holes and a pocket', async () => {
    const pocket = {
      vertices: new Float32Array([-10, -10, 10, -10, 10, 10, -10, 10]),
      depth: 8,
      clearance: 0,
      posX: 0,
      posY: 0,
      zTop: 21
    }
    const params = binParams({
      screwHoles: { enabled: true, diameter: 3, depth: 6 },
      pockets: [pocket]
    })
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(params)]]), 'bin')
    const mesh = await readMesh(buffer!)

    expect(openEdges(mesh)).toBe(0)
    expect(shells(mesh)).toBe(1)
  })

  it('keeps two bins as two closed solids', async () => {
    const results = new Map([
      ['a', bake(binParams({ widthUnits: 1, depthUnits: 1 }))],
      ['b', bake(binParams({ widthUnits: 1, depthUnits: 1 }))]
    ])
    const placements = new Map([
      ['a', { cx: 21, cy: -21 }],
      ['b', { cx: 63, cy: -21 }]
    ])
    const buffer = await build3MFArrayBuffer(results, 'bins', placements)
    const mesh = await readMesh(buffer!)

    expect(openEdges(mesh)).toBe(0)
    expect(shells(mesh)).toBe(2)
  })

  it('stays closed when two square pockets share a corner', async () => {
    const square = new Float32Array([-5, -5, 5, -5, 5, 5, -5, 5])
    const pocket = { vertices: square, depth: 8, clearance: 0, zTop: 21 }
    const params = binParams({
      magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
      pockets: [
        { ...pocket, posX: -5, posY: -5 },
        { ...pocket, posX: 5, posY: 5 }
      ]
    })
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(params)]]), 'bin')
    const mesh = await readMesh(buffer!)

    expect(openEdges(mesh)).toBe(0)
    expect(shells(mesh)).toBe(1)
  })

  it('stays closed when two round pockets touch at one point', async () => {
    const circle = { type: 'circle', radiusX: 8, radiusY: 8 } as LayoutShape
    const vertices = shapeToPocketVertices(circle)!
    const pocket = { vertices, depth: 8, clearance: 0, posY: 0, zTop: 21 }
    const params = binParams({
      magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
      pockets: [
        { ...pocket, posX: -8 },
        { ...pocket, posX: 8 }
      ]
    })
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(params)]]), 'bin')
    const mesh = await readMesh(buffer!)

    expect(openEdges(mesh)).toBe(0)
    expect(shells(mesh)).toBe(1)
  })

  it('cuts a round pocket to within the curve tolerance', async () => {
    const radius = 15
    const clearance = 0.25
    const segments = circleSegments(radius)
    const circle = { type: 'circle', radiusX: radius, radiusY: radius } as LayoutShape
    const vertices = shapeToPocketVertices(circle)!
    const floor = 21 - 8
    const params = binParams({
      magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
      pockets: [{ vertices, depth: 8, clearance, posX: 0, posY: 0, zTop: 21 }]
    })
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(params)]]), 'bin')
    const mesh = await readMesh(buffer!)

    const rim = mesh.vertices.filter(([, , z]) => Math.abs(z - floor) < 1e-4)
    expect(rim.length).toBeGreaterThanOrEqual(segments)
    const wall = radius + clearance
    for (const [x, y] of rim) {
      expect(Math.hypot(x, y)).toBeGreaterThan(wall - 2 * CURVE_TOLERANCE)
      expect(Math.hypot(x, y)).toBeLessThan(wall + 1e-4)
    }
    // Middle of the longest segment: the farthest the wall gets from a true circle.
    const angles = rim.map(([x, y]) => Math.atan2(y, x)).sort((a, b) => a - b)
    let widest = angles[0] + 2 * Math.PI - angles[angles.length - 1]
    for (let i = 1; i < angles.length; i++) widest = Math.max(widest, angles[i] - angles[i - 1])
    expect(wall * (1 - Math.cos(widest / 2))).toBeLessThan(2 * CURVE_TOLERANCE)
    expect(openEdges(mesh)).toBe(0)
  })

  it('cuts magnet holes with at least 64 sides', async () => {
    const params = binParams({ widthUnits: 1, depthUnits: 1 })
    const buffer = await build3MFArrayBuffer(new Map([['a', bake(params)]]), 'bin')
    const mesh = await readMesh(buffer!)

    const onHole = mesh.vertices.filter(
      ([x, y, z]) => Math.abs(z - 2.4) < 1e-4 && Math.abs(Math.hypot(x - 13, y - 13) - 3.25) < 1e-3
    )
    expect(onHole.length).toBeGreaterThanOrEqual(64)
  })

  it('bakes a small round pocket without collapsed triangles', () => {
    for (const radius of [0.3, 1.5, 3, 4]) {
      const circle = { type: 'circle', radiusX: radius, radiusY: radius } as LayoutShape
      const vertices = shapeToPocketVertices(circle)!
      const params = binParams({
        widthUnits: 1,
        depthUnits: 1,
        magnetHoles: { enabled: false, diameter: 6.5, depth: 2.4 },
        pockets: [{ vertices, depth: 8, clearance: 0.25, posX: 0, posY: 0, zTop: 21 }]
      })
      const { positions, indices } = buildBinCSG(params, manifold)
      const at = (i: number): string =>
        `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`

      let collapsed = 0
      for (let t = 0; t < indices.length; t += 3) {
        const [a, b, c] = [at(indices[t]), at(indices[t + 1]), at(indices[t + 2])]
        if (a === b || b === c || c === a) collapsed++
      }
      // A plain bin has 4 at the lip. A pocket must not add any.
      expect(collapsed, `radius ${radius}`).toBeLessThanOrEqual(4)
    }
  })
})
