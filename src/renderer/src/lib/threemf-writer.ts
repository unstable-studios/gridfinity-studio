/**
 * 3MF export utility.
 *
 * Produces a minimal but spec-compliant 3MF ZIP blob from a Three.js
 * BufferGeometry. The geometry must be non-indexed with a 'position'
 * attribute (i.e. toNonIndexed() has been called, or it was never
 * indexed to begin with).
 *
 * Spec: http://schemas.microsoft.com/3dmanufacturing/core/2015/02
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

  const vertexCount = posAttr.count
  const triangleCount = vertexCount / 3

  // Build vertex lines
  const vertexLines: string[] = []
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i)
    const y = posAttr.getY(i)
    const z = posAttr.getZ(i)
    vertexLines.push(`          <vertex x="${fmt(x)}" y="${fmt(y)}" z="${fmt(z)}" />`)
  }

  // Build triangle lines — non-indexed, so every 3 vertices is one triangle
  const triangleLines: string[] = []
  for (let t = 0; t < triangleCount; t++) {
    const v1 = t * 3
    const v2 = t * 3 + 1
    const v3 = t * 3 + 2
    triangleLines.push(`          <triangle v1="${v1}" v2="${v2}" v3="${v3}" />`)
  }

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

/** Format a float with up to 6 significant decimal places, no trailing zeros. */
function fmt(n: number): string {
  return parseFloat(n.toFixed(6)).toString()
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
 * @param geometry - A THREE.BufferGeometry. If indexed, it will be converted
 *   to non-indexed form internally before export.
 * @param name     - Object name embedded in the model XML (default "model").
 */
export async function export3MF(geometry: THREE.BufferGeometry, name = 'model'): Promise<Blob> {
  // Always work with a non-indexed copy so vertices align 1:1 with triangles.
  const geo = geometry.index ? geometry.toNonIndexed() : geometry

  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
  zip.folder('_rels')!.file('.rels', RELS_XML)
  zip.folder('3D')!.file('3dmodel.model', buildModelXml(geo, name))

  return zip.generateAsync({ type: 'blob' })
}
