// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import Module from 'manifold-3d'
import { buildBinCSG } from '../bin-csg-builder'
import type { CSGBinParams } from '../bin-csg-builder'
import { build3MFArrayBuffer } from '../export-baked'
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
})
