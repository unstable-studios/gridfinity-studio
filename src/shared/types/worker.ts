/**
 * Worker message types for the geometry Web Worker.
 *
 * The geometry worker handles CPU-intensive mesh operations off the main thread:
 * extrusion, boolean ops, and final bin baking.
 */

// ─── Mesh transfer format ─────────────────────────────────────────

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface MeshDataWithNormals extends MeshData {
  normals: Float32Array
  colors: Float32Array
}

// ─── Request types ────────────────────────────────────────────────

export type WorkerRequest =
  | { type: 'init' }
  | {
      type: 'extrude'
      id: string
      vertices: Float32Array
      depth: number
      direction: 'up' | 'down'
      role: 'solid' | 'cutter'
    }
  | {
      type: 'boolean'
      id: string
      op: 'union' | 'subtract' | 'intersect'
      meshA: MeshData
      meshB: MeshData
    }
  | {
      type: 'bake'
      id: string
      bin: MeshData
      solids: MeshData[]
      cutters: MeshData[]
    }

// ─── Response types ───────────────────────────────────────────────

export type WorkerResponse =
  | { type: 'init'; success: boolean; error?: string }
  | ({ type: 'extrude'; id: string } & MeshDataWithNormals)
  | ({ type: 'boolean'; id: string } & MeshDataWithNormals)
  | ({
      type: 'bake'
      id: string
      warnings: string[]
    } & MeshDataWithNormals)
  | { type: 'error'; id?: string; error: string }
  | { type: 'progress'; id: string; stage: string; percent: number }
