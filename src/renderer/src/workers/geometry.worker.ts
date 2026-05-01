import type { WorkerRequest, WorkerResponse, MeshData } from '../../../shared/types/worker'
import { buildBinCSG } from '../lib/bin-csg-builder'
// Imported as a URL so Vite emits a hashed asset (manifold-XXXX.wasm) and
// returns its URL — works in both dev (HTTP) and Electron production
// (file:// protocol). A bare `/manifold.wasm` fails in production because
// `self.location.origin` is empty under file://, leaving the path resolved
// against filesystem root.
import manifoldWasmUrl from 'manifold-3d/manifold.wasm?url'

// Worker globals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any as {
  postMessage: (msg: WorkerResponse, opts?: StructuredSerializeOptions) => void
}

// ─── Manifold WASM state ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let manifoldModule: any = null

async function initManifold(): Promise<boolean> {
  try {
    const Module = (await import('manifold-3d')).default
    manifoldModule = await Module({
      locateFile: () => manifoldWasmUrl
    })
    manifoldModule.setup()
    console.log('[geometry.worker] Manifold WASM initialized successfully')
    return true
  } catch (err) {
    console.error('[geometry.worker] Failed to initialize manifold WASM:', err)
    return false
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function meshDataToManifold(data: MeshData): {
  vertProperties: Float32Array
  triVerts: Uint32Array
} {
  return {
    vertProperties: data.positions,
    triVerts: data.indices
  }
}

function manifoldToMeshData(mesh: {
  vertProperties: Float32Array
  triVerts: Uint32Array
  numProp: number
}): { positions: Float32Array; indices: Uint32Array; normals: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(mesh.vertProperties.length)
  const vertCount = mesh.vertProperties.length / mesh.numProp
  for (let i = 0; i < vertCount; i++) {
    const offset = i * mesh.numProp
    positions[i * 3] = mesh.vertProperties[offset]
    positions[i * 3 + 1] = mesh.vertProperties[offset + 1]
    positions[i * 3 + 2] = mesh.vertProperties[offset + 2]
  }

  const indices = new Uint32Array(mesh.triVerts)

  // Compute normals
  const normals = new Float32Array(vertCount * 3)
  for (let i = 0; i < indices.length; i += 3) {
    const ai = indices[i] * 3
    const bi = indices[i + 1] * 3
    const ci = indices[i + 2] * 3

    const ax = positions[bi] - positions[ai]
    const ay = positions[bi + 1] - positions[ai + 1]
    const az = positions[bi + 2] - positions[ai + 2]
    const bx = positions[ci] - positions[ai]
    const by = positions[ci + 1] - positions[ai + 1]
    const bz = positions[ci + 2] - positions[ai + 2]

    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx

    normals[ai] += nx
    normals[ai + 1] += ny
    normals[ai + 2] += nz
    normals[bi] += nx
    normals[bi + 1] += ny
    normals[bi + 2] += nz
    normals[ci] += nx
    normals[ci + 1] += ny
    normals[ci + 2] += nz
  }

  for (let i = 0; i < vertCount; i++) {
    const offset = i * 3
    const len = Math.sqrt(
      normals[offset] ** 2 + normals[offset + 1] ** 2 + normals[offset + 2] ** 2
    )
    if (len > 0) {
      normals[offset] /= len
      normals[offset + 1] /= len
      normals[offset + 2] /= len
    }
  }

  // Empty colors — worker-generated meshes don't have debug colors
  const colors = new Float32Array(0)
  return { positions, indices, normals, colors }
}

// ─── Message handler ─────────────────────────────────────────────

addEventListener('message', (event: MessageEvent<WorkerRequest>): void => {
  const msg = event.data

  switch (msg.type) {
    case 'init': {
      void initManifold().then((success) => {
        const response: WorkerResponse = {
          type: 'init',
          success,
          error: success ? undefined : 'Failed to load manifold WASM'
        }
        ctx.postMessage(response)
      })
      break
    }

    case 'boolean': {
      if (!manifoldModule) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: 'Manifold WASM not initialized'
        } satisfies WorkerResponse)
        break
      }

      try {
        const { Manifold, Mesh } = manifoldModule
        const meshA = new Mesh(meshDataToManifold(msg.meshA))
        const meshB = new Mesh(meshDataToManifold(msg.meshB))
        const manifoldA = new Manifold(meshA)
        const manifoldB = new Manifold(meshB)

        let resultManifold
        switch (msg.op) {
          case 'union':
            resultManifold = Manifold.union(manifoldA, manifoldB)
            break
          case 'subtract':
            resultManifold = Manifold.difference(manifoldA, manifoldB)
            break
          case 'intersect':
            resultManifold = Manifold.intersection(manifoldA, manifoldB)
            break
        }

        const resultMesh = resultManifold.getMesh()
        const result = manifoldToMeshData(resultMesh)

        const response: WorkerResponse = {
          type: 'boolean',
          id: msg.id,
          ...result
        }
        ctx.postMessage(response, {
          transfer: [result.positions.buffer, result.indices.buffer, result.normals.buffer]
        })
      } catch (err) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: `Boolean operation failed: ${err instanceof Error ? err.message : String(err)}`
        } satisfies WorkerResponse)
      }
      break
    }

    case 'bake': {
      if (!manifoldModule) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: 'Manifold WASM not initialized'
        } satisfies WorkerResponse)
        break
      }

      try {
        const { Manifold, Mesh } = manifoldModule

        // Start with the bin mesh
        const binMesh = new Mesh(meshDataToManifold(msg.bin))
        let result = new Manifold(binMesh)

        // Union all solids
        for (const solid of msg.solids) {
          const solidMesh = new Mesh(meshDataToManifold(solid))
          const solidManifold = new Manifold(solidMesh)
          result = Manifold.union(result, solidManifold)
        }

        // Subtract all cutters
        for (const cutter of msg.cutters) {
          const cutterMesh = new Mesh(meshDataToManifold(cutter))
          const cutterManifold = new Manifold(cutterMesh)
          result = Manifold.difference(result, cutterManifold)
        }

        const resultMesh = result.getMesh()
        const meshData = manifoldToMeshData(resultMesh)

        const response: WorkerResponse = {
          type: 'bake',
          id: msg.id,
          warnings: [],
          ...meshData
        }
        ctx.postMessage(response, {
          transfer: [meshData.positions.buffer, meshData.indices.buffer, meshData.normals.buffer]
        })
      } catch (err) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: `Bake failed: ${err instanceof Error ? err.message : String(err)}`
        } satisfies WorkerResponse)
      }
      break
    }

    case 'bake-pockets': {
      if (!manifoldModule) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: 'Manifold WASM not initialized'
        } satisfies WorkerResponse)
        break
      }

      try {
        const warnings: string[] = []
        const t0 = performance.now()

        console.log('[worker] Building full CSG bin...')
        const csgResult = buildBinCSG(msg.binParams, manifoldModule)
        const totalMs = (performance.now() - t0).toFixed(1)
        const verts = csgResult.positions.length / 3
        const tris = csgResult.indices.length / 3
        console.log(
          `[worker] CSG bake complete: ${verts} verts, ${tris} tris, ${msg.binParams.pockets.length} pockets (${totalMs}ms)`
        )

        const colors = new Float32Array(0)
        const response: WorkerResponse = {
          type: 'bake-pockets',
          id: msg.id,
          warnings,
          positions: csgResult.positions,
          indices: csgResult.indices,
          normals: csgResult.normals,
          colors
        }
        ctx.postMessage(response, {
          transfer: [csgResult.positions.buffer, csgResult.indices.buffer, csgResult.normals.buffer]
        })
      } catch (err) {
        console.error('[worker] Bake-pockets failed:', err)
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: `Bake-pockets failed: ${err instanceof Error ? err.message : String(err)}`
        } satisfies WorkerResponse)
      }
      break
    }

    default: {
      const response: WorkerResponse = {
        type: 'error',
        error: `Unknown message type: ${(msg as { type: string }).type}`
      }
      ctx.postMessage(response)
      break
    }
  }
})
