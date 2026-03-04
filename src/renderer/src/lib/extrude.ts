/**
 * Polygon extrusion — turns a 2D vertex loop into a closed 3D mesh.
 *
 * Uses Three.js's bundled Earcut for triangulating the polygon cap,
 * then stitches side quads between the top and bottom rings.
 */

import { Earcut } from 'three/src/extras/Earcut.js'

// ─── Types ────────────────────────────────────────────────────────

interface Vertex2D {
  x: number
  y: number
}

interface ExtrudeResult {
  positions: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

// ─── Helpers ──────────────────────────────────────────────────────

function computeTriangleNormal(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): [number, number, number] {
  const ux = bx - ax
  const uy = by - ay
  const uz = bz - az
  const vx = cx - ax
  const vy = cy - ay
  const vz = cz - az

  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len > 0) {
    nx /= len
    ny /= len
    nz /= len
  }

  return [nx, ny, nz]
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Extrude a 2D polygon into a closed 3D mesh.
 *
 * - `vertices` — ordered 2D points forming a closed polygon (CW or CCW)
 * - `depth` — extrusion distance (always positive)
 * - `direction` — 'up' places the top cap at z=depth, bottom at z=0;
 *                  'down' places the top cap at z=0, bottom at z=-depth
 */
export function extrudePolygon(
  vertices: Vertex2D[],
  depth: number,
  direction: 'up' | 'down'
): ExtrudeResult {
  const n = vertices.length
  if (n < 3) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0)
    }
  }

  const topZ = direction === 'up' ? depth : 0
  const bottomZ = direction === 'up' ? 0 : -depth

  // ── Triangulate the cap ───────────────────────────────────────
  const flat: number[] = []
  for (const v of vertices) {
    flat.push(v.x, v.y)
  }
  const capIndices = Earcut.triangulate(flat, undefined, 2)

  // ── Count geometry ────────────────────────────────────────────
  // Top cap: n verts, Bottom cap: n verts, Sides: 4 verts per edge (n edges)
  const capTriCount = capIndices.length / 3
  const sideQuadCount = n
  const totalVerts = n + n + sideQuadCount * 4
  const totalTris = capTriCount * 2 + sideQuadCount * 2

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const indices = new Uint32Array(totalTris * 3)

  let vi = 0 // vertex write index (component-level)
  let ii = 0 // index write index
  let baseVertex = 0

  // ── Top cap ───────────────────────────────────────────────────
  const topBase = baseVertex
  for (let i = 0; i < n; i++) {
    positions[vi] = vertices[i].x
    positions[vi + 1] = vertices[i].y
    positions[vi + 2] = topZ
    normals[vi] = 0
    normals[vi + 1] = 0
    normals[vi + 2] = 1
    vi += 3
    baseVertex++
  }
  for (let i = 0; i < capIndices.length; i += 3) {
    indices[ii++] = topBase + capIndices[i]
    indices[ii++] = topBase + capIndices[i + 1]
    indices[ii++] = topBase + capIndices[i + 2]
  }

  // ── Bottom cap (reversed winding) ────────────────────────────
  const bottomBase = baseVertex
  for (let i = 0; i < n; i++) {
    positions[vi] = vertices[i].x
    positions[vi + 1] = vertices[i].y
    positions[vi + 2] = bottomZ
    normals[vi] = 0
    normals[vi + 1] = 0
    normals[vi + 2] = -1
    vi += 3
    baseVertex++
  }
  for (let i = 0; i < capIndices.length; i += 3) {
    indices[ii++] = bottomBase + capIndices[i + 2]
    indices[ii++] = bottomBase + capIndices[i + 1]
    indices[ii++] = bottomBase + capIndices[i]
  }

  // ── Side faces ────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    const ax = vertices[i].x
    const ay = vertices[i].y
    const bx = vertices[next].x
    const by = vertices[next].y

    // Four vertices per side quad
    const sideBase = baseVertex

    // top-left (current vertex, top)
    positions[vi] = ax
    positions[vi + 1] = ay
    positions[vi + 2] = topZ
    vi += 3

    // top-right (next vertex, top)
    positions[vi] = bx
    positions[vi + 1] = by
    positions[vi + 2] = topZ
    vi += 3

    // bottom-right (next vertex, bottom)
    positions[vi] = bx
    positions[vi + 1] = by
    positions[vi + 2] = bottomZ
    vi += 3

    // bottom-left (current vertex, bottom)
    positions[vi] = ax
    positions[vi + 1] = ay
    positions[vi + 2] = bottomZ
    vi += 3

    // Compute face normal from the first triangle
    const normal = computeTriangleNormal(ax, ay, topZ, bx, by, topZ, bx, by, bottomZ)

    for (let j = 0; j < 4; j++) {
      const ni = (sideBase + j) * 3
      normals[ni] = normal[0]
      normals[ni + 1] = normal[1]
      normals[ni + 2] = normal[2]
    }

    // Two triangles per quad
    indices[ii++] = sideBase
    indices[ii++] = sideBase + 1
    indices[ii++] = sideBase + 2

    indices[ii++] = sideBase
    indices[ii++] = sideBase + 2
    indices[ii++] = sideBase + 3

    baseVertex += 4
  }

  return { positions, indices, normals }
}
