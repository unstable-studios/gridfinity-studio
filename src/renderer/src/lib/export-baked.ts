/**
 * Bake-result → single THREE.BufferGeometry → STL/3MF Blob → IPC for save dialog.
 *
 * Combines every baked mesh into one geometry so a multi-bin project exports as
 * a single file. Each bin is offset along the X axis by its outer width so they
 * appear side-by-side in the slicer (matches how a print bed would arrange
 * them). Single-bin projects are unaffected.
 */
import * as THREE from 'three'
import { exportSTL as exportSTLBlob } from './stl-io'
import { export3MF as export3MFBlob } from './threemf-writer'
import type { BakeResult } from '@/hooks/useProject'

/**
 * Combine all baked meshes into a single BufferGeometry. Bins are laid out
 * along +X with the configured spacing between them.
 */
export function combineBakedMeshes(
  bakeResults: Map<string, BakeResult>,
  spacing: number = 5
): THREE.BufferGeometry | null {
  const meshes = [...bakeResults.values()]
  if (meshes.length === 0) return null

  const positionsList: Float32Array[] = []
  const normalsList: Float32Array[] = []
  const indicesList: Uint32Array[] = []
  let vertexOffset = 0
  let xOffset = 0

  for (const result of meshes) {
    const { positions, normals, indices } = result.mesh

    // Compute mesh's X extent for next-bin offset
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    const width = maxX - minX

    // Shift this mesh by xOffset
    const shifted = new Float32Array(positions.length)
    for (let i = 0; i < positions.length; i += 3) {
      shifted[i] = positions[i] + xOffset
      shifted[i + 1] = positions[i + 1]
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
    xOffset += width + spacing
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
  bakeResults: Map<string, BakeResult>
): Promise<ArrayBuffer | null> {
  const geo = combineBakedMeshes(bakeResults)
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
  modelName: string
): Promise<ArrayBuffer | null> {
  const geo = combineBakedMeshes(bakeResults)
  if (!geo) return null
  const blob = await export3MFBlob(geo, modelName)
  return blobToArrayBuffer(blob)
}
