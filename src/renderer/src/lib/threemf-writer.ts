/**
 * 3MF export utility.
 *
 * Writes a 3MF package from a Three.js BufferGeometry. Corners at the same
 * position are written as one vertex, so triangles that touch share vertex
 * indices. A slicer joins triangles by index: without shared vertices it reads
 * every triangle as a separate open surface.
 *
 * Spec: https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md
 */

import JSZip from 'jszip'
import * as THREE from 'three'

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

  const { vertexLines, triangleLines } = weld(posAttr, geometry.index)

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
 * Merge corners that share a position and list each triangle by merged vertex.
 * Geometry arrives with corners split for shading, or with no index at all.
 * A triangle that collapses to a line or point is left out.
 */
function weld(
  posAttr: THREE.BufferAttribute,
  index: THREE.BufferAttribute | null
): { vertexLines: string[]; triangleLines: string[] } {
  const vertexLines: string[] = []
  const triangleLines: string[] = []
  const written = new Map<string, number>()
  const cornerCount = index ? index.count : posAttr.count

  const vertexAt = (corner: number): number => {
    const i = index ? index.getX(corner) : corner
    const line = `          <vertex x="${fmt(posAttr.getX(i))}" y="${fmt(posAttr.getY(i))}" z="${fmt(posAttr.getZ(i))}" />`
    let vertex = written.get(line)
    if (vertex === undefined) {
      vertex = vertexLines.length
      written.set(line, vertex)
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
