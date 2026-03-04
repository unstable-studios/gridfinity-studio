/**
 * Conversion utilities between Three.js BufferGeometry and plain
 * typed-array mesh data (positions + indices + optional normals).
 *
 * These helpers bridge the renderer's Three.js objects and the
 * geometry worker's transferable ArrayBuffer messages.
 */

import * as THREE from 'three'

// ─── Types ────────────────────────────────────────────────────────

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface MeshDataWithNormals extends MeshData {
  normals: Float32Array
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Extract position and index arrays from a BufferGeometry.
 *
 * Throws if the geometry has no index buffer — call
 * `geometry.toNonIndexed()` or add an index first.
 */
export function bufferGeometryToMeshData(geometry: THREE.BufferGeometry): MeshData {
  const posAttr = geometry.getAttribute('position')
  if (!posAttr) {
    throw new Error('BufferGeometry has no position attribute')
  }

  const positions = new Float32Array(posAttr.array)

  const indexAttr = geometry.getIndex()
  if (!indexAttr) {
    throw new Error('BufferGeometry has no index — convert to indexed geometry first')
  }

  const indices = new Uint32Array(indexAttr.array)

  return { positions, indices }
}

/**
 * Build a BufferGeometry from plain typed arrays.
 *
 * If normals are omitted the geometry's `computeVertexNormals()`
 * is called automatically.
 */
export function meshDataToBufferGeometry(data: {
  positions: Float32Array
  indices: Uint32Array
  normals?: Float32Array
}): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))

  if (data.normals && data.normals.length > 0) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  } else {
    geometry.computeVertexNormals()
  }

  return geometry
}
