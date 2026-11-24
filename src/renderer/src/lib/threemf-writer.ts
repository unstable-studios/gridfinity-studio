/**
 * 3MF export utility.
 *
 * Writes a 3MF package from a Three.js BufferGeometry. A slicer joins triangles
 * by vertex index: without shared vertices it reads every triangle as a separate
 * open surface.
 *
 * Geometry that carries a `SOLID_VERTEX` attribute says which corners are the
 * same vertex of the solid, and is written that way. Two walls that only touch
 * stay separate. Other geometry has its corners joined by position.
 *
 * Spec: https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md
 */

import JSZip from 'jszip'
import * as THREE from 'three'

/**
 * Name of the attribute that numbers each vertex by the vertex of the closed solid it belongs
 * to. Vertices with the same number are written as one.
 */
export const SOLID_VERTEX = 'solidVertex'

// ─── Internal helpers ─────────────────────────────────────────────────────────

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`

function buildModelXml(geometry: THREE.BufferGeometry, name: string): string {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!posAttr || posAttr.count === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model" name="${escapeXml(name)}">
      <mesh>
        <vertices />
        <triangles />
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`
  }

  const solidAttr = geometry.getAttribute(SOLID_VERTEX) as THREE.BufferAttribute | undefined
  const { vertexLines, triangleLines } = weld(posAttr, geometry.index, solidAttr)

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model" name="${escapeXml(name)}">
      <mesh>
        <vertices>
${vertexLines.join('\n')}
        </vertices>
        <triangles>
${triangleLines.join('\n')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`
}

/**
 * Merge corners that are the same vertex and list each triangle by merged vertex.
 * Geometry arrives with corners split for shading, or with no index at all.
 *
 * Without `solidAttr`, corners are the same vertex when they share a position.
 * With it, they are the same vertex when it gives them the same number. Two numbers are also
 * joined where one triangle has both at the same position: that edge has no length, and
 * closing it removes the triangle. Manifold leaves a few of these, at the lip of a bin.
 *
 * A triangle that names a vertex twice is left out.
 */
function weld(
  posAttr: THREE.BufferAttribute,
  index: THREE.BufferAttribute | null,
  solidAttr: THREE.BufferAttribute | undefined
): { vertexLines: string[]; triangleLines: string[] } {
  const vertexLines: string[] = []
  const triangleLines: string[] = []
  const written = new Map<string | number, number>()
  const cornerCount = index ? index.count : posAttr.count
  const source = (corner: number): number => (index ? index.getX(corner) : corner)
  const lineAt = (i: number): string =>
    `          <vertex x="${fmt(posAttr.getX(i))}" y="${fmt(posAttr.getY(i))}" z="${fmt(posAttr.getZ(i))}" />`

  // Solid vertex numbers that were joined, each pointing at the one that stands for it.
  const joined = new Map<number, number>()
  const standsFor = (solid: number): number => {
    let root = solid
    for (let next = joined.get(root); next !== undefined; next = joined.get(root)) root = next
    // Point everything on the way at the root, so a long run of joins stays fast.
    for (let at = solid; at !== root;) {
      const next = joined.get(at)!
      joined.set(at, root)
      at = next
    }
    return root
  }
  if (solidAttr) {
    for (let corner = 0; corner + 2 < cornerCount; corner += 3) {
      const corners = [source(corner), source(corner + 1), source(corner + 2)]
      const lines = corners.map(lineAt)
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [2, 0]
      ]) {
        if (lines[a] !== lines[b]) continue
        const rootA = standsFor(solidAttr.getX(corners[a]))
        const rootB = standsFor(solidAttr.getX(corners[b]))
        if (rootA !== rootB) joined.set(rootB, rootA)
      }
    }
  }

  const vertexAt = (corner: number): number => {
    const i = source(corner)
    const line = lineAt(i)
    const key = solidAttr ? standsFor(solidAttr.getX(i)) : line
    let vertex = written.get(key)
    if (vertex === undefined) {
      vertex = vertexLines.length
      written.set(key, vertex)
      vertexLines.push(line)
    }
    return vertex
  }

  for (let corner = 0; corner + 2 < cornerCount; corner += 3) {
    const v1 = vertexAt(corner)
    const v2 = vertexAt(corner + 1)
    const v3 = vertexAt(corner + 2)
    if (v1 === v2 || v2 === v3 || v3 === v1) continue
    triangleLines.push(`          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`)
  }

  return { vertexLines, triangleLines }
}

/** Format a float with up to 6 decimal places, no trailing zeros and no negative zero. */
function fmt(n: number): string {
  return (parseFloat(n.toFixed(6)) + 0).toString()
}

/** Escape the five XML special characters. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Export a BufferGeometry as a 3MF ZIP Blob.
 *
 * @param geometry - A THREE.BufferGeometry, indexed or not.
 * @param name     - Object name embedded in the model XML (default "model").
 */
export async function export3MF(geometry: THREE.BufferGeometry, name = 'model'): Promise<Blob> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
  zip.folder('_rels')!.file('.rels', RELS_XML)
  zip.folder('3D')!.file('3dmodel.model', buildModelXml(geometry, name))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
