/**
 * Bake-result → single THREE.BufferGeometry → STL/3MF Blob → IPC for save dialog.
 *
 * Combines every baked mesh into one geometry so a multi-bin project exports as
 * a single file. Bins are placed at their 2D layout positions so the export
 * matches what the user designed and what's shown in Preview.
 */
import * as THREE from 'three'
import { exportSTL as exportSTLBlob } from './stl-io'
import { export3MF as export3MFBlob } from './threemf-writer'
import type { BakeResult } from '@/hooks/useProject'

/**
 * Position of a baked bin in the 2D editor (same coords used to place its
 * mesh in the 3D Preview). When supplied, exported geometry preserves the
 * spatial layout. Without it, bins stack at (0, 0) which is wrong for any
 * multi-bin project.
 */
export interface BinPlacement {
  /** Editor centroid x — shifts mesh on the X axis. */
  cx: number
  /** Editor centroid y — shifts mesh on the Z axis (3D depth). */
  cy: number
}

/**
 * Combine all baked meshes into a single BufferGeometry, placing each bin at
 * its layout position. The CSG builder centers each bin's mesh at its own
 * (0, 0), so we translate by the editor centroid to lay them out as designed.
 *
 * `placements`: per-bin centroid; missing entries fall back to (0, 0) which
 * is safe only for single-bin projects. Caller (Sidebar / Navbar) is expected
 * to supply this from the LayoutEngine for multi-bin layouts.
 */
export function combineBakedMeshes(
  bakeResults: Map<string, BakeResult>,
  placements?: Map<string, BinPlacement>
): THREE.BufferGeometry | null {
  const entries = [...bakeResults.entries()]
  if (entries.length === 0) return null

  const positionsList: Float32Array[] = []
  const normalsList: Float32Array[] = []
  const indicesList: Uint32Array[] = []
  let vertexOffset = 0

  for (const [binId, result] of entries) {
    const { positions, normals, indices } = result.mesh
    const place = placements?.get(binId)
    const dx = place?.cx ?? 0
    // Editor +y is screen-down; in the 3D scene we map that to +Z (away).
    // Match the same mapping here so STL/3MF positions match Preview.
    const dz = place?.cy ?? 0

    const shifted = new Float32Array(positions.length)
    for (let i = 0; i < positions.length; i += 3) {
      // CSG geometry is built in XY (Manifold). The Preview rotates the
      // group -90° around X so original-Y maps to world +Z. Apply the
      // same baked-frame translation: +cx on X, -cy on Y (since the export
      // STL is in the CSG/Manifold frame, not the Three.js post-rotation
      // frame). dz is the editor y; in CSG frame that's the Y axis.
      shifted[i] = positions[i] + dx
      shifted[i + 1] = positions[i + 1] - dz
      shifted[i + 2] = positions[i + 2]
    }
    positionsList.push(shifted)
    normalsList.push(normals)

    const reindexed = new Uint32Array(indices.length)
    for (let i = 0; i < indices.length; i++) {
      reindexed[i] = indices[i] + vertexOffset
    }
    indicesList.push(reindexed)

    vertexOffset += positions.length / 3
  }

  // Concat
  const totalPositions = positionsList.reduce((s, a) => s + a.length, 0)
  const totalIndices = indicesList.reduce((s, a) => s + a.length, 0)
  const positions = new Float32Array(totalPositions)
  const normals = new Float32Array(totalPositions)
  const indices = new Uint32Array(totalIndices)

  let pOff = 0
  let iOff = 0
  for (let i = 0; i < positionsList.length; i++) {
    positions.set(positionsList[i], pOff)
    normals.set(normalsList[i], pOff)
    pOff += positionsList[i].length
    indices.set(indicesList[i], iOff)
    iOff += indicesList[i].length
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  return geo
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer()
}

/**
 * Build the STL ArrayBuffer for the current bake. Returns null if there's
 * nothing baked yet.
 */
export async function buildSTLArrayBuffer(
  bakeResults: Map<string, BakeResult>,
  placements?: Map<string, BinPlacement>
): Promise<ArrayBuffer | null> {
  const geo = combineBakedMeshes(bakeResults, placements)
  if (!geo) return null
  const blob = exportSTLBlob(geo)
  return blobToArrayBuffer(blob)
}

/**
 * Build the 3MF ArrayBuffer for the current bake. Returns null if there's
 * nothing baked yet.
 */
export async function build3MFArrayBuffer(
  bakeResults: Map<string, BakeResult>,
  modelName: string,
  placements?: Map<string, BinPlacement>
): Promise<ArrayBuffer | null> {
  const geo = combineBakedMeshes(bakeResults, placements)
  if (!geo) return null
  const blob = await export3MFBlob(geo, modelName)
  return blobToArrayBuffer(blob)
}

/**
 * Helper: build a placements map from layout groups. Caller passes the
 * subset of groups that are bins (e.g. filtered with isBinGroup).
 */
export function placementsFromGroups(
  groups: Array<{ id: string; x: number; y: number; width: number; height: number }>
): Map<string, BinPlacement> {
  const out = new Map<string, BinPlacement>()
  for (const g of groups) {
    out.set(g.id, { cx: g.x + g.width / 2, cy: g.y - g.height / 2 })
  }
  return out
}
