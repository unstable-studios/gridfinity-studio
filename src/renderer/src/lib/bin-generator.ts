import earcut from 'earcut'

/**
 * Parametric Gridfinity bin mesh generator.
 *
 * Produces geometry conforming to the Gridfinity specification:
 *   - Stepped/chamfered base profile that mates with baseplates
 *   - Stacking lip profile at the top for bin stacking
 *   - Internal grid dividers for multi-unit bins
 *   - Optional magnet/screw recesses at grid-unit corners
 *   - Rounded corners matching spec radii (3.75mm outer)
 *
 * All dimensions are in millimetres. The mesh is built directly
 * from vertices and indices — no CSG dependency.
 *
 * Reference: gridfinity-rebuilt-openscad (kennetek), cq-gridfinity (michaelgave)
 */

// ─── Gridfinity Spec Constants ───────────────────────────────────

/**
 * Per-unit base profile cross-section.
 * Values are [inset_from_outer_edge, height_from_bottom].
 * The profile is INVERTED at generation time: at z=0 the ring is
 * at maximum inset (narrowest), expanding upward to meet the wall.
 */
const BASE_PROFILE = [
  [0, 0],
  [0.8, 0.8], // 45° chamfer
  [0.8, 2.6], // vertical wall (1.8mm tall)
  [2.95, 4.95] // 45° chamfer up to floor
] as const

/** Stacking lip cross-section (inset from outer wall, height from bin top) */
export const LIP_PROFILE = [
  [0, 0],
  [0.7, 0.7], // 45° chamfer
  [0.7, 2.5], // vertical wall (1.8mm tall)
  [2.6, 4.4] // 45° chamfer
] as const

export const BASE_PROFILE_HEIGHT = 4.95
export const LIP_HEIGHT = 4.4

export const WALL_THICKNESS = 0.95 // exterior wall per spec
export const LIP_OFFSET = 0.25 // gap between outer wall and groove at the top (spec: 0.25mm)
const DIVIDER_WIDTH = 1.2
export const FLOOR_THICKNESS = 1.0

const HOLE_SEGMENTS = 24
const MAGNET_HOLE_OFFSET = 8 // mm from unit cell edge to hole center

/** Number of arc segments per rounded corner */
const CORNER_SEGMENTS = 8
/** Outer corner radius per Gridfinity spec */
const OUTER_CORNER_RADIUS = 3.75

// ─── Debug Colors (per feature section) ──────────────────────────

const COLORS = {
  baseBottom: [0.8, 0.2, 0.2], // red — bottom face
  baseChamfer: [1.0, 0.5, 0.0], // orange — base profile chamfers/walls
  baseTransition: [1.0, 0.8, 0.0], // yellow — base-to-wall transition
  outerWalls: [0.2, 0.7, 0.2], // green — main outer walls
  innerWalls: [0.2, 0.5, 0.8], // blue — inner cavity walls
  floor: [0.3, 0.3, 0.9], // blue-purple — floor
  dividers: [0.7, 0.3, 0.7], // purple — grid dividers
  lipProfile: [0.9, 0.2, 0.5], // pink — stacking lip profile
  lipInner: [0.8, 0.4, 0.6], // light pink — lip inner faces
  lipCap: [1.0, 0.6, 0.8], // pale pink — lip top cap
  lipStep: [0.6, 0.2, 0.4], // dark pink — lip horizontal step
  rim: [0.5, 0.8, 0.8], // cyan — top rim (no lip)
  holeWalls: [0.9, 0.9, 0.2], // yellow — magnet/screw recess walls
  holeCaps: [0.7, 0.7, 0.1], // dark yellow — magnet/screw recess caps
  pocketWalls: [0.2, 0.8, 0.6], // teal — pocket side walls
  pocketFloor: [0.1, 0.6, 0.5] // dark teal — pocket floor
} as const

// ─── Types ────────────────────────────────────────────────────────

/** A pocket to cut into the bin floor */
export interface PocketGeometry {
  /** 2D vertices in bin-local coordinates (centered at bin origin) */
  vertices: Array<[number, number]>
  /** How deep below the floor surface the pocket goes (mm) */
  depth: number
}

export interface BinParams {
  widthUnits: number
  depthUnits: number
  heightUnits: number
  baseUnit: number
  unitHeight: number
  tolerance: number
  hasLip: boolean
  hasDividers: boolean
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
  /** Pockets to cut into the bin floor */
  pockets?: PocketGeometry[]
}

export interface MeshResult {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

// ─── Rounded Rectangle Ring ──────────────────────────────────────

/**
 * Generate points for a rounded rectangle centred at the origin.
 *
 * The corner radius decreases with inset: r = OUTER_CORNER_RADIUS − inset,
 * clamped to [0, min(halfW, halfD)].
 *
 * Always returns exactly `4 × CORNER_SEGMENTS` points so that any two
 * rings produced by this function can be connected with quads.
 */
export function roundedRectPoints(hw: number, hd: number, inset: number): Array<[number, number]> {
  const x = hw - inset
  const y = hd - inset
  const r = Math.min(Math.max(0, OUTER_CORNER_RADIUS - inset), x, y)

  const n = CORNER_SEGMENTS
  const points: Array<[number, number]> = []

  // Four corner arcs traced CCW when viewed from +Z
  const corners = [
    { cx: x - r, cy: y - r, a0: 0 }, // top-right
    { cx: -(x - r), cy: y - r, a0: Math.PI / 2 }, // top-left
    { cx: -(x - r), cy: -(y - r), a0: Math.PI }, // bottom-left
    { cx: x - r, cy: -(y - r), a0: (3 * Math.PI) / 2 } // bottom-right
  ]

  for (const { cx, cy, a0 } of corners) {
    for (let i = 0; i < n; i++) {
      const angle = a0 + (i / n) * (Math.PI / 2)
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
    }
  }

  return points
}

// ─── Geometry Builder ────────────────────────────────────────────

/** Mutable builder that tracks position, normal, color, and index buffers */
class MeshBuilder {
  pos: number[] = []
  norm: number[] = []
  col: number[] = []
  idx: number[] = []
  private cr = 1
  private cg = 1
  private cb = 1

  setColor(rgb: readonly number[]): void {
    this.cr = rgb[0]
    this.cg = rgb[1]
    this.cb = rgb[2]
  }

  pushVertex(x: number, y: number, z: number): number {
    const i = this.pos.length / 3
    this.pos.push(x, y, z)
    this.col.push(this.cr, this.cg, this.cb)
    return i
  }

  pushNormal(nx: number, ny: number, nz: number): void {
    this.norm.push(nx, ny, nz)
  }

  pushQuad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c)
    this.idx.push(a, c, d)
  }

  /** Add a vertex with normal in one call */
  addVN(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const i = this.pushVertex(x, y, z)
    this.pushNormal(nx, ny, nz)
    return i
  }

  /** Add a flat quad with explicit normal */
  quad(
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
    const a = this.addVN(x0, y0, z0, nx, ny, nz)
    const b = this.addVN(x1, y1, z1, nx, ny, nz)
    const c = this.addVN(x2, y2, z2, nx, ny, nz)
    const d = this.addVN(x3, y3, z3, nx, ny, nz)
    this.pushQuad(a, b, c, d)
  }

  /** Add a quad with auto-computed normal */
  quadAuto(
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
    z3: number
  ): void {
    const [nx, ny, nz] = faceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2)
    this.quad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, nx, ny, nz)
  }

  /**
   * Connect two rounded rings of equal point count with quads.
   * By default normals face outward. Pass `inward = true` for cavity walls.
   */
  connectRoundedRings(
    lower: ReadonlyArray<[number, number]>,
    lowerZ: number,
    upper: ReadonlyArray<[number, number]>,
    upperZ: number,
    inward = false
  ): void {
    const n = lower.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (inward) {
        // j→i swap — CCW from inside (for cavity / inner walls)
        this.quadAuto(
          lower[j][0],
          lower[j][1],
          lowerZ,
          lower[i][0],
          lower[i][1],
          lowerZ,
          upper[i][0],
          upper[i][1],
          upperZ,
          upper[j][0],
          upper[j][1],
          upperZ
        )
      } else {
        // i→j order — CCW from outside (for outer walls, base, lip)
        this.quadAuto(
          lower[i][0],
          lower[i][1],
          lowerZ,
          lower[j][0],
          lower[j][1],
          lowerZ,
          upper[j][0],
          upper[j][1],
          upperZ,
          upper[i][0],
          upper[i][1],
          upperZ
        )
      }
    }
  }

  /** Fill a flat rounded-rect face with a triangle fan from the centroid */
  addFlatFan(points: ReadonlyArray<[number, number]>, z: number, nz: number, cx = 0, cy = 0): void {
    const center = this.addVN(cx, cy, z, 0, 0, nz)
    const ring: number[] = []
    for (const [px, py] of points) {
      ring.push(this.addVN(px, py, z, 0, 0, nz))
    }
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length
      if (nz > 0) {
        this.idx.push(center, ring[i], ring[j])
      } else {
        this.idx.push(center, ring[j], ring[i])
      }
    }
  }

  /**
   * Fill a flat annular ring between an outer and inner rounded rect.
   * Both rings must have the same number of points.
   */
  addFlatRing(
    outer: ReadonlyArray<[number, number]>,
    inner: ReadonlyArray<[number, number]>,
    z: number,
    nz: number
  ): void {
    const n = outer.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const oi = this.addVN(outer[i][0], outer[i][1], z, 0, 0, nz)
      const oj = this.addVN(outer[j][0], outer[j][1], z, 0, 0, nz)
      const ii = this.addVN(inner[i][0], inner[i][1], z, 0, 0, nz)
      const ij = this.addVN(inner[j][0], inner[j][1], z, 0, 0, nz)
      if (nz > 0) {
        this.idx.push(oi, oj, ij)
        this.idx.push(oi, ij, ii)
      } else {
        this.idx.push(oi, ii, ij)
        this.idx.push(oi, ij, oj)
      }
    }
  }

  /**
   * Triangulate a flat face with holes cut out using earcut.
   * The boundary and holes are 2D point arrays; the face is placed at z with normal nz.
   */
  addFlatFaceWithHoles(
    boundary: ReadonlyArray<[number, number]>,
    holes: ReadonlyArray<ReadonlyArray<[number, number]>>,
    z: number,
    nz: number
  ): void {
    const coords: number[] = []
    const holeIndices: number[] = []

    for (const [px, py] of boundary) {
      coords.push(px, py)
    }
    for (const hole of holes) {
      holeIndices.push(coords.length / 2)
      for (const [px, py] of hole) {
        coords.push(px, py)
      }
    }

    const triangles = earcut(coords, holeIndices.length > 0 ? holeIndices : undefined)

    const totalPts = coords.length / 2
    const baseIdx = this.pos.length / 3
    for (let i = 0; i < totalPts; i++) {
      this.addVN(coords[i * 2], coords[i * 2 + 1], z, 0, 0, nz)
    }

    for (let i = 0; i < triangles.length; i += 3) {
      if (nz > 0) {
        this.idx.push(
          baseIdx + triangles[i],
          baseIdx + triangles[i + 1],
          baseIdx + triangles[i + 2]
        )
      } else {
        this.idx.push(
          baseIdx + triangles[i],
          baseIdx + triangles[i + 2],
          baseIdx + triangles[i + 1]
        )
      }
    }
  }

  /**
   * Add an octagonal prism recess going UPWARD into the base.
   * The opening is at floorZ (bottom face) and the blind end is at floorZ + depth.
   */
  addOctagonalRecess(
    cx: number,
    cy: number,
    diameter: number,
    depth: number,
    floorZ: number,
    wallColor: readonly number[],
    capColor: readonly number[]
  ): void {
    const r = diameter / 2
    const n = HOLE_SEGMENTS
    const capZ = floorZ + depth

    // Walls (visible from inside the hole — normals point inward toward center)
    this.setColor(wallColor)
    const openRing: number[] = []
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n
      const nx = -Math.cos(angle)
      const ny = -Math.sin(angle)
      openRing.push(
        this.addVN(cx + r * Math.cos(angle), cy + r * Math.sin(angle), floorZ, nx, ny, 0)
      )
    }

    const wallCapRing: number[] = []
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n
      const nx = -Math.cos(angle)
      const ny = -Math.sin(angle)
      wallCapRing.push(
        this.addVN(cx + r * Math.cos(angle), cy + r * Math.sin(angle), capZ, nx, ny, 0)
      )
    }

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      this.idx.push(openRing[i], wallCapRing[i], wallCapRing[next])
      this.idx.push(openRing[i], wallCapRing[next], openRing[next])
    }

    // Blind end cap at capZ (facing down, visible from below — CW from +Z)
    this.setColor(capColor)
    const capCenter = this.addVN(cx, cy, capZ, 0, 0, -1)
    const capRing: number[] = []
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n
      capRing.push(this.addVN(cx + r * Math.cos(angle), cy + r * Math.sin(angle), capZ, 0, 0, -1))
    }

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n
      this.idx.push(capCenter, capRing[next], capRing[i])
    }
  }

  toResult(): MeshResult {
    return {
      positions: new Float32Array(this.pos),
      colors: new Float32Array(this.col),
      indices: new Uint32Array(this.idx),
      normals: new Float32Array(this.norm)
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Offset every point in a ring by (dx, dy) */
function offsetRing(
  ring: ReadonlyArray<[number, number]>,
  dx: number,
  dy: number
): Array<[number, number]> {
  return ring.map(([x, y]) => [x + dx, y + dy])
}

function faceNormal(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
): [number, number, number] {
  const ux = x1 - x0,
    uy = y1 - y0,
    uz = z1 - z0
  const vx = x2 - x0,
    vy = y2 - y0,
    vz = z2 - z0
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len === 0) return [0, 0, 1]
  return [nx / len, ny / len, nz / len]
}

// ─── Main Generator ──────────────────────────────────────────────

/**
 * Generate a Gridfinity bin mesh from the given parameters.
 *
 * The bin is centred at the XY origin with the bottom at z=0 and
 * the top opening (or stacking lip) at the top.
 *
 * Geometry layers from bottom to top:
 *   1. Base profile (stepped chamfer — narrow at bottom, expanding up)
 *   2. Main walls (from base top to bin top)
 *   3. Interior cavity (floor + inner walls)
 *   4. Grid dividers (for multi-unit bins)
 *   5. Top rim or stacking lip
 *   6. Magnet/screw recesses (cut into bottom)
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
    hasDividers,
    magnetHoles,
    screwHoles
  } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const hw = outerW / 2
  const hd = outerD / 2
  const totalH = heightUnits * unitHeight

  const innerFloorZ = FLOOR_THICKNESS + BASE_PROFILE_HEIGHT

  const m = new MeshBuilder()

  // ── Precompute rings ──────────────────────────────────────────
  const outerRing = roundedRectPoints(hw, hd, 0)
  // When the bin has a lip, the cavity wall aligns with the groove bottom
  // (the lip body is solid between the outer wall and the groove).
  // Without a lip, the wall is just WALL_THICKNESS.
  const maxLipInset = LIP_PROFILE[LIP_PROFILE.length - 1][0] // 2.6
  const cavityInset = hasLip ? LIP_OFFSET + maxLipInset : WALL_THICKNESS
  const innerRing = roundedRectPoints(hw, hd, cavityInset)

  // Maximum inset in the base profile — used to invert the profile
  // so that the bottom is narrowest and the top meets the outer wall.
  const maxBaseInset = BASE_PROFILE[BASE_PROFILE.length - 1][0] // 2.95

  // ── Precompute hole configs ────────────────────────────────────
  const holeConfigs: Array<{ diameter: number; depth: number }> = []
  if (magnetHoles.enabled) {
    holeConfigs.push({ diameter: magnetHoles.diameter, depth: magnetHoles.depth })
  }
  if (screwHoles.enabled) {
    holeConfigs.push({ diameter: screwHoles.diameter, depth: screwHoles.depth })
  }

  // Per-unit cell half-size: each 42mm cell has its own base profile
  // with tolerance gap between adjacent cells
  const cellHW = baseUnit / 2 - tolerance
  const cellHD = baseUnit / 2 - tolerance

  // ── 1. Per-unit base profiles (stepped chamfer per grid cell) ──
  // Each 42mm grid cell gets its own independent base foot with
  // bottom face, chamfer steps, and magnet/screw recesses.
  const maxR = holeConfigs.length > 0 ? Math.max(...holeConfigs.map((h) => h.diameter / 2)) : 0

  for (let gx = 0; gx < widthUnits; gx++) {
    for (let gy = 0; gy < depthUnits; gy++) {
      // Cell center in world space (bin centered at origin)
      const ccx = baseUnit * (gx + 0.5 - widthUnits / 2)
      const ccy = baseUnit * (gy + 0.5 - depthUnits / 2)

      // Hole positions for this cell (4 corners)
      const cornerOffset = baseUnit / 2 - MAGNET_HOLE_OFFSET
      const cellHoles: Array<{ cx: number; cy: number }> = []
      if (holeConfigs.length > 0) {
        cellHoles.push(
          { cx: ccx - cornerOffset, cy: ccy - cornerOffset },
          { cx: ccx + cornerOffset, cy: ccy - cornerOffset },
          { cx: ccx + cornerOffset, cy: ccy + cornerOffset },
          { cx: ccx - cornerOffset, cy: ccy + cornerOffset }
        )
      }

      // Bottom face (with hole cutouts if any)
      m.setColor(COLORS.baseBottom)
      const bottomRing = offsetRing(roundedRectPoints(cellHW, cellHD, maxBaseInset), ccx, ccy)
      if (cellHoles.length > 0) {
        const holeBoundaries: Array<Array<[number, number]>> = []
        for (const hp of cellHoles) {
          const pts: Array<[number, number]> = []
          for (let i = 0; i < HOLE_SEGMENTS; i++) {
            const angle = (2 * Math.PI * i) / HOLE_SEGMENTS
            pts.push([hp.cx + maxR * Math.cos(angle), hp.cy + maxR * Math.sin(angle)])
          }
          holeBoundaries.push(pts)
        }
        m.addFlatFaceWithHoles(bottomRing, holeBoundaries, 0, -1)
      } else {
        m.addFlatFan(bottomRing, 0, -1, ccx, ccy)
      }

      // Base profile steps (narrow bottom → wide top)
      m.setColor(COLORS.baseChamfer)
      for (let i = 0; i < BASE_PROFILE.length - 1; i++) {
        const [inset0, z0] = BASE_PROFILE[i]
        const [inset1, z1] = BASE_PROFILE[i + 1]
        const lower = offsetRing(roundedRectPoints(cellHW, cellHD, maxBaseInset - inset0), ccx, ccy)
        const upper = offsetRing(roundedRectPoints(cellHW, cellHD, maxBaseInset - inset1), ccx, ccy)
        m.connectRoundedRings(lower, z0, upper, z1)
      }

      // Magnet / screw recesses for this cell
      if (cellHoles.length > 0) {
        for (const hp of cellHoles) {
          for (const hole of holeConfigs) {
            m.addOctagonalRecess(
              hp.cx,
              hp.cy,
              hole.diameter,
              hole.depth,
              0,
              COLORS.holeWalls,
              COLORS.holeCaps
            )
          }
        }
      }
    }
  }

  // Transition: fill the top of the base platform at BASE_PROFILE_HEIGHT.
  // The per-unit feet end at their cell edges; the outer wall is one ring.
  // Both faces needed: up (visible from above) and down (visible from below).
  m.setColor(COLORS.baseTransition)
  m.addFlatFan(outerRing, BASE_PROFILE_HEIGHT, 1)
  m.addFlatFan(outerRing, BASE_PROFILE_HEIGHT, -1)

  // ── 2. Main outer walls ───────────────────────────────────────
  m.setColor(COLORS.outerWalls)
  const outerWallTop = hasLip ? totalH + LIP_HEIGHT : totalH
  m.connectRoundedRings(outerRing, BASE_PROFILE_HEIGHT, outerRing, outerWallTop)

  // ── 3. Interior cavity ────────────────────────────────────────

  // Inner walls (inward = true → CCW from inside the cavity)
  m.setColor(COLORS.innerWalls)
  m.connectRoundedRings(innerRing, innerFloorZ, innerRing, totalH, true)

  // Floor (with pocket cutouts if any)
  const pockets = params.pockets ?? []
  m.setColor(COLORS.floor)
  if (pockets.length > 0) {
    // Floor with holes cut for each pocket outline
    const pocketHoles = pockets.map((p) => p.vertices)
    m.addFlatFaceWithHoles(innerRing, pocketHoles, innerFloorZ, 1)

    // Each pocket: walls going down from floor + floor cap at the bottom
    for (const pocket of pockets) {
      const pocketBottomZ = innerFloorZ - pocket.depth
      const n = pocket.vertices.length

      // Pocket walls (inward-facing, visible from inside the pocket)
      m.setColor(COLORS.pocketWalls)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const [ax, ay] = pocket.vertices[i]
        const [bx, by] = pocket.vertices[j]
        // Winding: looking from inside the pocket, we see j→i order (inward)
        m.quadAuto(
          bx,
          by,
          pocketBottomZ,
          ax,
          ay,
          pocketBottomZ,
          ax,
          ay,
          innerFloorZ,
          bx,
          by,
          innerFloorZ
        )
      }

      // Pocket floor cap (upward-facing, visible from above)
      m.setColor(COLORS.pocketFloor)
      const cx = pocket.vertices.reduce((s, v) => s + v[0], 0) / n
      const cy = pocket.vertices.reduce((s, v) => s + v[1], 0) / n
      m.addFlatFan(pocket.vertices, pocketBottomZ, 1, cx, cy)
    }
  } else {
    m.addFlatFan(innerRing, innerFloorZ, 1)
  }

  // ── 4. Internal grid dividers (optional) ──────────────────────
  if (hasDividers) {
    m.setColor(COLORS.dividers)
    const halfDiv = DIVIDER_WIDTH / 2
    // Use the cavity inset for divider wall extent
    const innerHW = hw - cavityInset
    const innerHD = hd - cavityInset

    for (let gx = 1; gx < widthUnits; gx++) {
      const x = -hw + gx * baseUnit
      m.quad(
        x + halfDiv,
        -innerHD,
        innerFloorZ,
        x + halfDiv,
        innerHD,
        innerFloorZ,
        x + halfDiv,
        innerHD,
        totalH,
        x + halfDiv,
        -innerHD,
        totalH,
        1,
        0,
        0
      )
      m.quad(
        x - halfDiv,
        innerHD,
        innerFloorZ,
        x - halfDiv,
        -innerHD,
        innerFloorZ,
        x - halfDiv,
        -innerHD,
        totalH,
        x - halfDiv,
        innerHD,
        totalH,
        -1,
        0,
        0
      )
      m.quad(
        x - halfDiv,
        -innerHD,
        totalH,
        x - halfDiv,
        innerHD,
        totalH,
        x + halfDiv,
        innerHD,
        totalH,
        x + halfDiv,
        -innerHD,
        totalH,
        0,
        0,
        1
      )
    }

    for (let gy = 1; gy < depthUnits; gy++) {
      const y = -hd + gy * baseUnit
      m.quad(
        -innerHW,
        y + halfDiv,
        innerFloorZ,
        innerHW,
        y + halfDiv,
        innerFloorZ,
        innerHW,
        y + halfDiv,
        totalH,
        -innerHW,
        y + halfDiv,
        totalH,
        0,
        1,
        0
      )
      m.quad(
        innerHW,
        y - halfDiv,
        innerFloorZ,
        -innerHW,
        y - halfDiv,
        innerFloorZ,
        -innerHW,
        y - halfDiv,
        totalH,
        innerHW,
        y - halfDiv,
        totalH,
        0,
        -1,
        0
      )
      m.quad(
        -innerHW,
        y - halfDiv,
        totalH,
        innerHW,
        y - halfDiv,
        totalH,
        innerHW,
        y + halfDiv,
        totalH,
        -innerHW,
        y + halfDiv,
        totalH,
        0,
        0,
        1
      )
    }
  }

  // ── 5. Top rim / stacking lip ─────────────────────────────────
  if (hasLip) {
    // The stacking lip is a GROOVE (female) at the top of the bin that
    // receives the base profile (male) of the next bin stacked on top.
    //
    // Per spec, the groove is offset 0.25mm inward from the outer wall,
    // creating a thin "point" at the top where the lip meets the outer wall.
    //
    // Cross-section (right side, dimensions from outer edge):
    //
    //   outer │0.25│                      cavity
    //   wall  │gap │  groove inner wall   inner wall
    //         │    │╲ 1.9mm 45°           │
    //         │    │ │ 1.8mm vert         │
    //         │    │╱ 0.7mm 45°           │
    //   totalH└────└────────────┐─────────┤
    //              groove floor  lip body  │
    //
    // The groove inner wall (lipProfile) IS the inner surface of the lip
    // as seen from inside the bin cavity. No separate inner lip wall needed.

    const lipBase = totalH
    const lipTopZ = lipBase + LIP_HEIGHT
    // Groove top ring at lipTopZ (narrowest: LIP_OFFSET from outer = the "point")
    const grooveTopRing = roundedRectPoints(hw, hd, LIP_OFFSET)

    // Groove inner wall: follows LIP_PROFILE with 0.25mm offset from outer wall.
    // At totalH the groove is widest (= innerRing = cavityInset from outer).
    // At lipTopZ the groove narrows to just 0.25mm from outer (the thin point).
    // The groove inner wall IS the cavity inner surface above totalH.
    m.setColor(COLORS.lipProfile)
    for (let i = 0; i < LIP_PROFILE.length - 1; i++) {
      const [inset0, z0] = LIP_PROFILE[i]
      const [inset1, z1] = LIP_PROFILE[i + 1]
      const lower = roundedRectPoints(hw, hd, LIP_OFFSET + maxLipInset - inset0)
      const upper = roundedRectPoints(hw, hd, LIP_OFFSET + maxLipInset - inset1)
      m.connectRoundedRings(lower, lipBase + z0, upper, lipBase + z1, true)
    }

    // Lip cap at lipTopZ: thin 0.25mm ring from outer wall to groove top (the "point")
    m.setColor(COLORS.lipCap)
    m.addFlatRing(outerRing, grooveTopRing, lipTopZ, 1)
  } else {
    // No lip — flat top rim connecting outer to inner
    m.setColor(COLORS.rim)
    m.addFlatRing(outerRing, innerRing, totalH, 1)
  }

  return m.toResult()
}
