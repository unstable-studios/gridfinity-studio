/**
 * STL import/export utilities.
 *
 * Uses Three.js's STLExporter to produce binary STL blobs that can
 * be saved to disk or transferred to the main process via IPC.
 */

import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

// ─── Public API ───────────────────────────────────────────────────

/**
 * Export a BufferGeometry as a binary STL Blob.
 */
export function exportSTL(geometry: THREE.BufferGeometry): Blob {
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.Mesh(geometry, material)

  const exporter = new STLExporter()
  const buffer = exporter.parse(mesh, { binary: true })

  // STLExporter.parse with binary: true returns a DataView
  return new Blob([buffer], { type: 'application/octet-stream' })
}
