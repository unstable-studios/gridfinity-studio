import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import * as THREE from 'three'
import { export3MF, SOLID_VERTEX } from '../threemf-writer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function unzip(blob: Blob): Promise<JSZip> {
  const arrayBuffer = await blob.arrayBuffer()
  return JSZip.loadAsync(arrayBuffer)
}

async function readEntry(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  if (!file) throw new Error(`Entry not found in ZIP: ${path}`)
  return file.async('string')
}

/** Count occurrences of a substring. */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/**
 * Build a non-indexed BufferGeometry from a flat Float32Array of positions.
 * Three values per vertex, three vertices per triangle.
 */
function makeGeometry(positions: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geo
}

// A single triangle in the XY plane
const singleTrianglePositions = [0, 0, 0, 1, 0, 0, 0, 1, 0]

/** The same, with each vertex numbered by the vertex of the solid it belongs to. */
function makeSolidGeometry(positions: number[], solidVertices: number[]): THREE.BufferGeometry {
  const geo = makeGeometry(positions)
  geo.setAttribute(SOLID_VERTEX, new THREE.BufferAttribute(new Uint32Array(solidVertices), 1))
  return geo
}

// ─── ZIP structure ────────────────────────────────────────────────────────────

describe('export3MF — ZIP structure', () => {
  it('returns a Blob', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const result = await export3MF(geo)
    expect(result).toBeInstanceOf(Blob)
  })

  it('produces a valid ZIP that can be read back by JSZip', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const blob = await export3MF(geo)
    // loadAsync throws if the bytes are not a valid ZIP — this is the real check
    await expect(unzip(blob)).resolves.toBeDefined()
  })

  it('ZIP contains [Content_Types].xml', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
  })

  it('ZIP contains _rels/.rels', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    expect(zip.file('_rels/.rels')).not.toBeNull()
  })

  it('ZIP contains 3D/3dmodel.model', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    expect(zip.file('3D/3dmodel.model')).not.toBeNull()
  })
})

// ─── Model XML — units ────────────────────────────────────────────────────────

describe('export3MF — unit attribute', () => {
  it('model XML declares unit="millimeter"', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(xml).toContain('unit="millimeter"')
  })

  it('model XML does not declare any other unit', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    // Make sure slicers won't default to meters or inches
    expect(xml).not.toContain('unit="meter"')
    expect(xml).not.toContain('unit="inch"')
  })
})

// ─── Model XML — correct namespace ────────────────────────────────────────────

describe('export3MF — XML namespace', () => {
  it('model XML uses the 3MF core namespace', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(xml).toContain('http://schemas.microsoft.com/3dmanufacturing/core/2015/02')
  })
})

// ─── Model XML — vertex and triangle counts ───────────────────────────────────

describe('export3MF — vertex and triangle counts', () => {
  it('single triangle: 3 vertices and 1 triangle in model XML', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(xml, '<vertex ')).toBe(3)
    expect(countOccurrences(xml, '<triangle ')).toBe(1)
  })

  it('BoxGeometry (non-indexed): 8 shared vertices and 12 triangles', async () => {
    // 36 corners at 8 positions. Each position is written once.
    const geo = new THREE.BoxGeometry(42, 42, 7).toNonIndexed()
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(xml, '<vertex ')).toBe(8)
    expect(countOccurrences(xml, '<triangle ')).toBe(12)
  })

  it('BoxGeometry (indexed): the same counts as non-indexed', async () => {
    // Indexed BoxGeometry has 24 vertices: each corner is split three ways for normals.
    const indexedGeo = new THREE.BoxGeometry(42, 42, 7)
    expect(indexedGeo.index).not.toBeNull()

    const zip = await unzip(await export3MF(indexedGeo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(xml, '<vertex ')).toBe(8)
    expect(countOccurrences(xml, '<triangle ')).toBe(12)
  })

  it('triangles that touch share vertex indices', async () => {
    const geo = makeGeometry([
      // triangle 0
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      // triangle 1 shares the edge from (1,0,0) to (0,1,0)
      1, 0, 0, 1, 1, 0, 0, 1, 0
    ])
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(xml, '<vertex ')).toBe(4)
    expect(xml).toContain('v1="0" v2="1" v3="2"')
    expect(xml).toContain('v1="1" v2="3" v3="2"')
  })

  it('leaves out a triangle that collapses to a line', async () => {
    const geo = makeGeometry([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 2, 0, 0, 3, 1, 0])
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(xml, '<triangle ')).toBe(1)
  })

  it('triangle indices reference only valid vertex positions (v1/v2/v3 < vertex count)', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    const vertexCount = countOccurrences(xml, '<vertex ')
    // Extract all v1/v2/v3 values
    const indexPattern = /v[123]="(\d+)"/g
    let match: RegExpExecArray | null
    while ((match = indexPattern.exec(xml)) !== null) {
      const idx = parseInt(match[1], 10)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(vertexCount)
    }
  })

  it('triangles that do not touch keep separate vertices', async () => {
    const geo = makeGeometry([
      // triangle 0
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      // triangle 1
      2, 0, 0, 3, 0, 0, 2, 1, 0
    ])
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(xml).toContain('v1="0" v2="1" v3="2"')
    expect(xml).toContain('v1="3" v2="4" v3="5"')
  })
})

// ─── Solid vertex numbers ─────────────────────────────────────────────────────

describe('export3MF — solid vertex numbers', () => {
  // Two triangles that meet along the edge from (1,0,0) to (0,1,0)
  const twoTriangles = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]

  it('joins vertices with the same number', async () => {
    const zip = await unzip(await export3MF(makeSolidGeometry(twoTriangles, [0, 1, 2, 1, 3, 2])))
    const model = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(model, '<vertex ')).toBe(4)
    expect(countOccurrences(model, '<triangle ')).toBe(2)
  })

  it('keeps vertices at one position apart when their numbers differ', async () => {
    const zip = await unzip(await export3MF(makeSolidGeometry(twoTriangles, [0, 1, 2, 3, 4, 5])))
    const model = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(model, '<vertex ')).toBe(6)
    expect(countOccurrences(model, '<triangle ')).toBe(2)
  })

  it('closes an edge with no length and drops its triangle', async () => {
    // The second triangle has vertices 1 and 3 at the same position.
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]
    const zip = await unzip(await export3MF(makeSolidGeometry(positions, [0, 1, 2, 1, 3, 2])))
    const model = await readEntry(zip, '3D/3dmodel.model')

    expect(countOccurrences(model, '<vertex ')).toBe(3)
    expect(countOccurrences(model, '<triangle ')).toBe(1)
  })
})

// ─── Model XML — vertex coordinates ──────────────────────────────────────────

describe('export3MF — vertex coordinates', () => {
  it('vertex coordinates match the original geometry positions', async () => {
    const geo = makeGeometry([1.5, 2.5, 3.5, 4, 5, 6, 7, 8, 9])
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')

    expect(xml).toContain('x="1.5" y="2.5" z="3.5"')
    expect(xml).toContain('x="4" y="5" z="6"')
    expect(xml).toContain('x="7" y="8" z="9"')
  })
})

// ─── Model XML — object name ──────────────────────────────────────────────────

describe('export3MF — object name', () => {
  it('default name is "model"', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(xml).toContain('name="model"')
  })

  it('custom name is embedded in the model XML', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo, 'Gridfinity Bin 2x3'))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(xml).toContain('name="Gridfinity Bin 2x3"')
  })

  it('XML-special characters in the name are escaped correctly', async () => {
    const geo = makeGeometry(singleTrianglePositions)
    const zip = await unzip(await export3MF(geo, 'Bin <1> & "2"'))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    // The raw special chars must NOT appear unescaped in an attribute value
    expect(xml).toContain('&lt;')
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&quot;')
    // The literal unescaped characters must not appear inside the name attribute
    expect(xml).not.toMatch(/name="[^"]*<[^"]*"/)
    expect(xml).not.toMatch(/name="[^"]*&(?!amp;|lt;|gt;|quot;|apos;)[^"]*"/)
  })
})

// ─── Edge case — empty geometry ───────────────────────────────────────────────

describe('export3MF — empty geometry', () => {
  it('empty geometry does not throw', async () => {
    const geo = new THREE.BufferGeometry()
    await expect(export3MF(geo)).resolves.toBeInstanceOf(Blob)
  })

  it('empty geometry produces a valid ZIP', async () => {
    const geo = new THREE.BufferGeometry()
    const blob = await export3MF(geo)
    await expect(unzip(blob)).resolves.toBeDefined()
  })

  it('empty geometry produces 0 vertices and 0 triangles', async () => {
    const geo = new THREE.BufferGeometry()
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(countOccurrences(xml, '<vertex ')).toBe(0)
    expect(countOccurrences(xml, '<triangle ')).toBe(0)
  })

  it('empty geometry model XML still contains the required model/build structure', async () => {
    const geo = new THREE.BufferGeometry()
    const zip = await unzip(await export3MF(geo))
    const xml = await readEntry(zip, '3D/3dmodel.model')
    expect(xml).toContain('<model')
    expect(xml).toContain('<resources>')
    expect(xml).toContain('<build>')
    expect(xml).toContain('<item objectid="1"')
  })
})
