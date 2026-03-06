/**
 * Polygon extrusion — turns a 2D vertex loop into a closed 3D mesh.
 *
 * Uses Three.js's bundled Earcut for triangulating the polygon cap,
 * then stitches side quads between the top and bottom rings.
 */

import earcut from 'earcut'

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

// ─── Polygon offset ──────────────────────────────────────────────

/**
 * Expand (or shrink) a 2D polygon by `offset` along vertex normals.
 * Positive offset expands outward, negative shrinks inward.
 * Handles both CW and CCW winding automatically.
 */
export function offsetPolygon(vertices: Vertex2D[], offset: number): Vertex2D[] {
  if (offset === 0 || vertices.length < 3) return vertices

  const n = vertices.length

  // Compute signed area to determine winding direction
  let signedArea = 0
  for (let i = 0; i < n; i++) {
    const curr = vertices[i]
    const next = vertices[(i + 1) % n]
    signedArea += (next.x - curr.x) * (next.y + curr.y)
  }
  // signedArea > 0 = CW, < 0 = CCW
  // Base outward normal formula (ey, -ex) is correct for CCW; flip for CW
  const windingSign = signedArea > 0 ? -1 : 1

  const result: Vertex2D[] = []

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n]
    const curr = vertices[i]
    const next = vertices[(i + 1) % n]

    // Edge vectors
    const e1x = curr.x - prev.x
    const e1y = curr.y - prev.y
    const e2x = next.x - curr.x
    const e2y = next.y - curr.y

    // Outward normals
    const len1 = Math.sqrt(e1x * e1x + e1y * e1y)
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y)
    if (len1 === 0 || len2 === 0) {
      result.push(curr)
      continue
    }

    // Right-hand normal = (dy, -dx) for CW, flip for CCW
    const n1x = (e1y / len1) * windingSign
    const n1y = (-e1x / len1) * windingSign
    const n2x = (e2y / len2) * windingSign
    const n2y = (-e2x / len2) * windingSign

    // Average normal at vertex
    let nx = n1x + n2x
    let ny = n1y + n2y
    const nLen = Math.sqrt(nx * nx + ny * ny)
    if (nLen === 0) {
      result.push(curr)
      continue
    }
    nx /= nLen
    ny /= nLen

    // Scale by 1/cos(half-angle) to maintain offset distance at edges
    const dot = n1x * nx + n1y * ny
    const scale = dot > 0.1 ? offset / dot : offset

    result.push({ x: curr.x + nx * scale, y: curr.y + ny * scale })
  }

  return result
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
 * - `zTop` — Z position of the top cap (default 0). Bottom cap is at zTop - depth.
 *
 * Pockets always extrude downward from zTop.
 */
export function extrudePolygon(
  vertices: Vertex2D[],
  depth: number,
  zTop: number = 0
): ExtrudeResult {
  const n = vertices.length
  if (n < 3) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0)
    }
  }

  const topZ = zTop
  const bottomZ = zTop - depth

  // ── Triangulate the cap ───────────────────────────────────────
  const flat: number[] = []
  for (const v of vertices) {
    flat.push(v.x, v.y)
  }
  const capIndices = earcut(flat, undefined, 2)

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
