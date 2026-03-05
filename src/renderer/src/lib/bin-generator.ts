/**
 * Parametric Gridfinity bin mesh generator.
 *
 * Produces a hollow box with floor, optional stacking lip, and
 * optional magnet/screw recesses. All dimensions are in millimetres.
 *
 * The mesh is built directly from vertices and indices — no CSG
 * dependency — so it can run synchronously on the main thread or
 * inside the geometry worker.
 */

// ─── Constants ────────────────────────────────────────────────────

const WALL_THICKNESS = 1.2
const FLOOR_THICKNESS = 1.0
const LIP_HEIGHT = 2.6
const LIP_STEP_INSET = 0.8
const OCTAGON_SIDES = 8

// ─── Types ────────────────────────────────────────────────────────

export interface BinParams {
  widthUnits: number
  depthUnits: number
  heightUnits: number
  baseUnit: number
  unitHeight: number
  tolerance: number
  hasLip: boolean
  magnetHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }
  screwHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }
}

interface MeshResult {
  positions: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

// ─── Helpers ──────────────────────────────────────────────────────

function pushVertex(buf: number[], x: number, y: number, z: number): number {
  const idx = buf.length / 3
  buf.push(x, y, z)
  return idx
}

function pushNormal(buf: number[], nx: number, ny: number, nz: number): void {
  buf.push(nx, ny, nz)
}

function pushQuad(idxBuf: number[], a: number, b: number, c: number, d: number): void {
  // Winding order produces CCW triangles matching the stated normals
  idxBuf.push(a, c, b)
  idxBuf.push(a, d, c)
}

/**
 * Add an octagonal prism recess into the floor at (cx, cy).
 * The prism extends from z=0 down to z=-depth.
 */
function addOctagonalRecess(
  posBuf: number[],
  normBuf: number[],
  idxBuf: number[],
  cx: number,
  cy: number,
  diameter: number,
  depth: number
): void {
  const r = diameter / 2
  const n = OCTAGON_SIDES

  // Top ring (z = 0) and bottom ring (z = -depth)
  const topCenter = pushVertex(posBuf, cx, cy, 0)
  pushNormal(normBuf, 0, 0, -1)

  const topRing: number[] = []
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n
    const idx = pushVertex(posBuf, cx + r * Math.cos(angle), cy + r * Math.sin(angle), 0)
    pushNormal(normBuf, 0, 0, -1)
    topRing.push(idx)
  }

  const bottomCenter = pushVertex(posBuf, cx, cy, -depth)
  pushNormal(normBuf, 0, 0, -1)

  const bottomRing: number[] = []
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n
    const idx = pushVertex(posBuf, cx + r * Math.cos(angle), cy + r * Math.sin(angle), -depth)
    pushNormal(normBuf, 0, 0, -1)
    bottomRing.push(idx)
  }

  // Bottom cap (visible looking up into the hole)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    idxBuf.push(bottomCenter, bottomRing[next], bottomRing[i])
  }

  // Side walls
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    // Side verts need their own normals — for simplicity reuse indices
    // and accept slightly wrong normals on the octagon walls
    idxBuf.push(topRing[i], topRing[next], bottomRing[next])
    idxBuf.push(topRing[i], bottomRing[next], bottomRing[i])
  }

  // NOTE: No top cap — the recess is an open-ended cutter mesh.
  // When manifold booleans are wired, this geometry will be subtracted
  // from the bin floor to create the actual recess cavity.
  void topCenter
}

// ─── Main generator ───────────────────────────────────────────────

/**
 * Generate a Gridfinity bin mesh from the given parameters.
 *
 * The bin is centred at the XY origin with the floor at z=0 and
 * the top opening at z = totalHeight.
 */
export function generateBinMesh(params: BinParams): MeshResult {
  const {
    widthUnits,
    depthUnits,
    heightUnits,
    baseUnit,
    unitHeight,
    tolerance,
    hasLip,
    magnetHoles,
    screwHoles
  } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const totalH = heightUnits * unitHeight

  const hw = outerW / 2
  const hd = outerD / 2
  const iw = hw - WALL_THICKNESS
  const id = hd - WALL_THICKNESS

  const posBuf: number[] = []
  const normBuf: number[] = []
  const idxBuf: number[] = []

  // Helper to add a flat quad with a uniform normal
  function quad(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number,
    nx: number,
    ny: number,
    nz: number
  ): void {
    const a = pushVertex(posBuf, x0, y0, z0)
    pushNormal(normBuf, nx, ny, nz)
    const b = pushVertex(posBuf, x1, y1, z1)
    pushNormal(normBuf, nx, ny, nz)
    const c = pushVertex(posBuf, x2, y2, z2)
    pushNormal(normBuf, nx, ny, nz)
    const d = pushVertex(posBuf, x3, y3, z3)
    pushNormal(normBuf, nx, ny, nz)
    pushQuad(idxBuf, a, b, c, d)
  }

  // ── Outer walls ─────────────────────────────────────────────────
  // Front (+Y)
  quad(-hw, hd, 0, hw, hd, 0, hw, hd, totalH, -hw, hd, totalH, 0, 1, 0)
  // Back (-Y)
  quad(hw, -hd, 0, -hw, -hd, 0, -hw, -hd, totalH, hw, -hd, totalH, 0, -1, 0)
  // Right (+X)
  quad(hw, hd, 0, hw, -hd, 0, hw, -hd, totalH, hw, hd, totalH, 1, 0, 0)
  // Left (-X)
  quad(-hw, -hd, 0, -hw, hd, 0, -hw, hd, totalH, -hw, -hd, totalH, -1, 0, 0)

  // ── Bottom face (outside, facing down) ──────────────────────────
  quad(-hw, -hd, 0, hw, -hd, 0, hw, hd, 0, -hw, hd, 0, 0, 0, -1)

  // ── Inner walls ─────────────────────────────────────────────────
  const innerFloorZ = FLOOR_THICKNESS

  // Front inner (-Y facing)
  quad(iw, id, innerFloorZ, -iw, id, innerFloorZ, -iw, id, totalH, iw, id, totalH, 0, -1, 0)
  // Back inner (+Y facing)
  quad(-iw, -id, innerFloorZ, iw, -id, innerFloorZ, iw, -id, totalH, -iw, -id, totalH, 0, 1, 0)
  // Right inner (-X facing)
  quad(iw, -id, innerFloorZ, iw, id, innerFloorZ, iw, id, totalH, iw, -id, totalH, -1, 0, 0)
  // Left inner (+X facing)
  quad(-iw, id, innerFloorZ, -iw, -id, innerFloorZ, -iw, -id, totalH, -iw, id, totalH, 1, 0, 0)

  // ── Floor (inside, facing up) ───────────────────────────────────
  quad(
    -iw,
    -id,
    innerFloorZ,
    -iw,
    id,
    innerFloorZ,
    iw,
    id,
    innerFloorZ,
    iw,
    -id,
    innerFloorZ,
    0,
    0,
    1
  )

  // ── Internal grid divider walls (for multi-unit bins) ──────────
  const halfWall = WALL_THICKNESS / 2

  // X-axis dividers (walls parallel to Y axis)
  for (let gx = 1; gx < widthUnits; gx++) {
    const x = -hw + gx * baseUnit
    // Front face (+X normal)
    quad(
      x + halfWall,
      -id,
      innerFloorZ,
      x + halfWall,
      id,
      innerFloorZ,
      x + halfWall,
      id,
      totalH,
      x + halfWall,
      -id,
      totalH,
      1,
      0,
      0
    )
    // Back face (-X normal)
    quad(
      x - halfWall,
      id,
      innerFloorZ,
      x - halfWall,
      -id,
      innerFloorZ,
      x - halfWall,
      -id,
      totalH,
      x - halfWall,
      id,
      totalH,
      -1,
      0,
      0
    )
  }

  // Y-axis dividers (walls parallel to X axis)
  for (let gy = 1; gy < depthUnits; gy++) {
    const y = -hd + gy * baseUnit
    // Front face (+Y normal)
    quad(
      -iw,
      y + halfWall,
      innerFloorZ,
      iw,
      y + halfWall,
      innerFloorZ,
      iw,
      y + halfWall,
      totalH,
      -iw,
      y + halfWall,
      totalH,
      0,
      1,
      0
    )
    // Back face (-Y normal)
    quad(
      iw,
      y - halfWall,
      innerFloorZ,
      -iw,
      y - halfWall,
      innerFloorZ,
      -iw,
      y - halfWall,
      totalH,
      iw,
      y - halfWall,
      totalH,
      0,
      -1,
      0
    )
  }

  // ── Top rim (connects outer and inner walls at the top) ─────────
  // Front rim
  quad(-hw, hd, totalH, hw, hd, totalH, iw, id, totalH, -iw, id, totalH, 0, 0, 1)
  // Back rim
  quad(hw, -hd, totalH, -hw, -hd, totalH, -iw, -id, totalH, iw, -id, totalH, 0, 0, 1)
  // Right rim
  quad(hw, hd, totalH, hw, -hd, totalH, iw, -id, totalH, iw, id, totalH, 0, 0, 1)
  // Left rim
  quad(-hw, -hd, totalH, -hw, hd, totalH, -iw, id, totalH, -iw, -id, totalH, 0, 0, 1)

  // ── Stacking lip (simplified as a step) ─────────────────────────
  if (hasLip) {
    const lipTop = totalH + LIP_HEIGHT
    const lipOw = hw - LIP_STEP_INSET
    const lipOd = hd - LIP_STEP_INSET

    // Outer lip walls
    quad(
      -lipOw,
      lipOd,
      totalH,
      lipOw,
      lipOd,
      totalH,
      lipOw,
      lipOd,
      lipTop,
      -lipOw,
      lipOd,
      lipTop,
      0,
      1,
      0
    )
    quad(
      lipOw,
      -lipOd,
      totalH,
      -lipOw,
      -lipOd,
      totalH,
      -lipOw,
      -lipOd,
      lipTop,
      lipOw,
      -lipOd,
      lipTop,
      0,
      -1,
      0
    )
    quad(
      lipOw,
      lipOd,
      totalH,
      lipOw,
      -lipOd,
      totalH,
      lipOw,
      -lipOd,
      lipTop,
      lipOw,
      lipOd,
      lipTop,
      1,
      0,
      0
    )
    quad(
      -lipOw,
      -lipOd,
      totalH,
      -lipOw,
      lipOd,
      totalH,
      -lipOw,
      lipOd,
      lipTop,
      -lipOw,
      -lipOd,
      lipTop,
      -1,
      0,
      0
    )

    // Lip step (horizontal face connecting outer wall to lip)
    quad(-hw, hd, totalH, -lipOw, lipOd, totalH, lipOw, lipOd, totalH, hw, hd, totalH, 0, 0, 1)
    quad(hw, -hd, totalH, lipOw, -lipOd, totalH, -lipOw, -lipOd, totalH, -hw, -hd, totalH, 0, 0, 1)
    quad(hw, hd, totalH, lipOw, lipOd, totalH, lipOw, -lipOd, totalH, hw, -hd, totalH, 0, 0, 1)
    quad(-hw, -hd, totalH, -lipOw, -lipOd, totalH, -lipOw, lipOd, totalH, -hw, hd, totalH, 0, 0, 1)

    // Inner lip walls (same as outer at this simplified step)
    quad(lipOw, id, totalH, -lipOw, id, totalH, -lipOw, id, lipTop, lipOw, id, lipTop, 0, -1, 0)
    quad(-lipOw, -id, totalH, lipOw, -id, totalH, lipOw, -id, lipTop, -lipOw, -id, lipTop, 0, 1, 0)
    quad(lipOw, -id, totalH, lipOw, id, totalH, lipOw, id, lipTop, lipOw, -id, lipTop, -1, 0, 0)
    quad(-lipOw, id, totalH, -lipOw, -id, totalH, -lipOw, -id, lipTop, -lipOw, id, lipTop, 1, 0, 0)

    // Lip top cap
    quad(
      -lipOw,
      -lipOd,
      lipTop,
      -lipOw,
      lipOd,
      lipTop,
      lipOw,
      lipOd,
      lipTop,
      lipOw,
      -lipOd,
      lipTop,
      0,
      0,
      1
    )
  }

  // ── Magnet / screw recesses ─────────────────────────────────────
  const holeConfigs: Array<{ diameter: number; depth: number }> = []
  if (magnetHoles.enabled) {
    holeConfigs.push({ diameter: magnetHoles.diameter, depth: magnetHoles.depth })
  }
  if (screwHoles.enabled) {
    holeConfigs.push({ diameter: screwHoles.diameter, depth: screwHoles.depth })
  }

  if (holeConfigs.length > 0) {
    // Place holes at each grid unit corner (inside the bin footprint)
    for (let gx = 0; gx < widthUnits; gx++) {
      for (let gy = 0; gy < depthUnits; gy++) {
        const cx = -hw + tolerance + baseUnit * (gx + 0.5)
        const cy = -hd + tolerance + baseUnit * (gy + 0.5)

        // Corner offsets within a single grid cell
        const cornerOffset = baseUnit / 2 - 4
        const corners = [
          { x: cx - cornerOffset, y: cy - cornerOffset },
          { x: cx + cornerOffset, y: cy - cornerOffset },
          { x: cx + cornerOffset, y: cy + cornerOffset },
          { x: cx - cornerOffset, y: cy + cornerOffset }
        ]

        for (const corner of corners) {
          for (const hole of holeConfigs) {
            addOctagonalRecess(
              posBuf,
              normBuf,
              idxBuf,
              corner.x,
              corner.y,
              hole.diameter,
              hole.depth
            )
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(posBuf),
    indices: new Uint32Array(idxBuf),
    normals: new Float32Array(normBuf)
  }
}
