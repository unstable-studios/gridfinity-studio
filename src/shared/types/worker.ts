/**
 * Worker message types for the geometry Web Worker.
 *
 * The geometry worker builds each bin's solid off the main thread.
 */

// ─── Mesh transfer format ─────────────────────────────────────────

/** A baked bin, as it crosses from the worker. */
export interface BakedMesh {
  positions: Float32Array
  indices: Uint32Array
  normals: Float32Array
  colors: Float32Array
  /** For each vertex, the vertex of the closed solid it came from. */
  solidVertices: Uint32Array
}

// ─── Request types ────────────────────────────────────────────────

export interface PocketSpec {
  /** The shape's name, to say which one could not be cut. */
  name?: string
  vertices: Float32Array
  depth: number
  clearance: number
  posX: number
  posY: number
  zTop: number
}

/** Full bin parameters for CSG building in the worker */
export interface CSGBinParams {
  /** The bin's name, to say which bin a warning is about. */
  name?: string
  widthUnits: number
  depthUnits: number
  heightUnits: number
  baseUnit: number
  unitHeight: number
  tolerance: number
  hasLip: boolean
  magnetHoles: { enabled: boolean; diameter: number; depth: number }
  screwHoles: { enabled: boolean; diameter: number; depth: number }
  pockets: PocketSpec[]
}

export type WorkerRequest =
  | { type: 'init' }
  | {
      type: 'bake-pockets'
      id: string
      binParams: CSGBinParams
    }

// ─── Response types ───────────────────────────────────────────────

export type WorkerResponse =
  | { type: 'init'; success: boolean; error?: string }
  | ({
      type: 'bake-pockets'
      id: string
      warnings: string[]
    } & BakedMesh)
  | { type: 'error'; id?: string; error: string }
