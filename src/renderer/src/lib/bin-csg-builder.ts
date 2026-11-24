/**
 * CSG-first Gridfinity bin builder using Manifold primitives.
 *
 * Builds a proper manifold-valid solid via boolean operations:
 *   union(feet, trunk) - difference(lip groove) - difference(holes) - difference(pockets)
 *
 * Tapers (the feet and the lip groove) are hulls of the outlines at their two ends.
 *
 * All dimensions in millimetres. Returns positions/indices/normals ready for Three.js.
 */

import { circleSegments } from './curve-segments'
import { BASE_PROFILE_HEIGHT, LIP_PROFILE, LIP_OFFSET, LIP_HEIGHT } from './bin-generator'

// ─── Gridfinity Spec Constants ───────────────────────────────────

/** Per-unit base profile: [inset_from_outer_edge, height_from_bottom] */
const BASE_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.8, 0.8],
  [0.8, 2.6],
  [2.95, 4.95]
]

const OUTER_CORNER_RADIUS = 3.75
const BASE_HEIGHT = 7
const MAGNET_HOLE_OFFSET = 8

/** Points closer to the outline than this are dropped after an offset, in mm. */
const OFFSET_CLEANUP = 1e-5

// ─── Types ───────────────────────────────────────────────────────

export interface CSGBinParams {
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

export interface PocketSpec {
  vertices: Float32Array
  depth: number
  clearance: number
  posX: number
  posY: number
  zTop: number
}

export interface CSGMeshResult {
  positions: Float32Array
  indices: Uint32Array
  normals: Float32Array
  /**
   * For each vertex, the vertex of the Manifold solid it was split from. Vertices are split
   * for shading, so this is the only record of which triangles the solid joins.
   */
  solidVertices: Uint32Array
}

// ─── Manifold type aliases (avoid importing manifold-3d types) ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManifoldModule = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Manifold = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrossSection = any

// ─── Memory ──────────────────────────────────────────────────────

/** Something Manifold made on its own heap. JavaScript never frees it: `delete` does. */
interface Disposable {
  delete(): void
}

/**
 * Everything the bake in progress has made. The geometry worker keeps one Manifold module
 * for as long as the app is open, so a bake that left its solids behind would use the
 * module's memory up, and after a few hundred bakes every bake would fail.
 */
let madeThisBake: Disposable[] | null = null

/** Note a solid or outline so it is freed when the bake ends. Returns it. */
function keep<T extends Disposable>(made: T): T {
  madeThisBake?.push(made)
  return made
}

/**
 * Extrude an outline straight up from z = 0.
 *
 * manifold-3d 3.5.5's own `extrude` copies the outline's points onto its heap and never
 * frees the copy. Its two inner calls are used here instead, so the copy can be freed. If a
 * later version drops them, this falls back to `extrude`, and the test that counts what a
 * bake leaves behind says so.
 */
function extrudeOutline(outline: CrossSection, height: number, M: ManifoldModule): Manifold {
  if (typeof M._Extrude !== 'function' || typeof outline._ToPolygons !== 'function') {
    return keep(M.Manifold.extrude(outline, height))
  }
  const points = keep(outline._ToPolygons())
  return keep(M._Extrude(points, height, 0, 0, { x: 1, y: 1 }))
}

// ─── Rounded Rectangle CrossSection ─────────────────────────────

/**
 * Build a rounded rectangle polygon (CCW) as an array of [x,y] points.
 * hw/hd = half-width/half-depth of the rectangle.
 * cornerRadius is clamped to fit within the rectangle.
 *
 * Each corner is a full quarter arc, so the walls between corners are straight and parallel
 * to the axes.
 */
export function roundedRectPolygon(
  hw: number,
  hd: number,
  cornerRadius: number
): Array<[number, number]> {
  const r = Math.min(Math.max(0, cornerRadius), hw, hd)
  const segments = circleSegments(r) / 4
  const points: Array<[number, number]> = []

  // Four corners CCW: top-right, top-left, bottom-left, bottom-right.
  // `from` and `to` are the [x, y] directions from the center to the two ends of the arc.
  const corners: Array<{ cx: number; cy: number; from: [number, number]; to: [number, number] }> = [
    { cx: hw - r, cy: hd - r, from: [1, 0], to: [0, 1] },
    { cx: -(hw - r), cy: hd - r, from: [0, 1], to: [-1, 0] },
    { cx: -(hw - r), cy: -(hd - r), from: [-1, 0], to: [0, -1] },
    { cx: hw - r, cy: -(hd - r), from: [0, -1], to: [1, 0] }
  ]

  const add = (x: number, y: number): void => {
    const last = points[points.length - 1]
    if (last && last[0] === x && last[1] === y) return
    points.push([x, y])
  }

  for (const { cx, cy, from, to } of corners) {
    const startAngle = Math.atan2(from[1], from[0])
    // The two ends are placed without sin and cos, so both ends of a wall get the same
    // coordinate.
    add(cx + r * from[0], cy + r * from[1])
    for (let i = 1; i < segments; i++) {
      const angle = startAngle + (i / segments) * (Math.PI / 2)
      add(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }
    add(cx + r * to[0], cy + r * to[1])
  }

  // A corner that fills the whole side ends where the first one began.
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop()

  return points
}

// ─── Build Steps ─────────────────────────────────────────────────

/** A rounded rectangle's outline as points in space, centered on (cx, cy) at height z. */
function ringAt(
  hw: number,
  hd: number,
  radius: number,
  cx: number,
  cy: number,
  z: number
): Array<[number, number, number]> {
  return roundedRectPolygon(hw, hd, radius).map(([x, y]) => [x + cx, y + cy, z])
}

/**
 * The feet: one under each grid square, each a stack of tapers following BASE_PROFILE.
 * A taper is the hull of the outlines at its bottom and top, so it is exact.
 */
function buildBaseFeet(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold } = M
  const { widthUnits, depthUnits, baseUnit, tolerance } = params

  const cellHW = baseUnit / 2 - tolerance
  const cellHD = baseUnit / 2 - tolerance
  const maxInset = BASE_PROFILE[BASE_PROFILE.length - 1][0]
  const feet: Manifold[] = []

  for (let gx = 0; gx < widthUnits; gx++) {
    for (let gy = 0; gy < depthUnits; gy++) {
      const ccx = baseUnit * (gx + 0.5 - widthUnits / 2)
      const ccy = baseUnit * (gy + 0.5 - depthUnits / 2)
      /** The foot's outline at a step of the profile. It is full size at the top step. */
      const ring = (step: number): Array<[number, number, number]> => {
        const [inset, z] = BASE_PROFILE[step]
        const grow = inset - maxInset
        return ringAt(
          cellHW + grow,
          cellHD + grow,
          Math.max(0.01, OUTER_CORNER_RADIUS + grow),
          ccx,
          ccy,
          z
        )
      }

      for (let step = 0; step < BASE_PROFILE.length - 1; step++) {
        feet.push(keep(Manifold.hull([...ring(step), ...ring(step + 1)])))
      }
    }
  }

  return keep(Manifold.union(feet))
}

/**
 * Everything above the feet: one prism from the top of the feet to the top of the bin. It is
 * one piece so that no seam runs around the bin where a base and a body would meet.
 */
function buildTrunk(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { CrossSection } = M
  const { widthUnits, depthUnits, baseUnit, tolerance, heightUnits, unitHeight, hasLip } = params

  const hw = (widthUnits * baseUnit - tolerance * 2) / 2
  const hd = (depthUnits * baseUnit - tolerance * 2) / 2
  const totalH = heightUnits * unitHeight
  // The trunk runs through the lip height: the groove is cut out of it afterwards. The
  // groove and the pockets are placed from `totalH`, so the height itself is not changed
  // here: only a bin that would end below the top of its base is brought up to it.
  const topZ = Math.max(hasLip ? totalH + LIP_HEIGHT : totalH, BASE_HEIGHT)
  const outline = keep(new CrossSection([roundedRectPolygon(hw, hd, OUTER_CORNER_RADIUS)]))
  const prism = extrudeOutline(outline, topZ - BASE_PROFILE_HEIGHT, M)
  return keep(prism.translate([0, 0, BASE_PROFILE_HEIGHT]))
}

/**
 * Build the lip groove cutter — the tapered inner volume to subtract from
 * the solid trunk so the stacking lip profile remains.
 *
 * The trunk extends through the full lip height as a solid block, so we
 * subtract the groove (the inner tapered shape that follows LIP_PROFILE)
 * to leave the correct annular lip behind.
 *
 * The groove is the union of hulled inner cross-section frustums for each
 * profile segment, from totalH to totalH + LIP_HEIGHT.
 */
function buildLipGroove(params: CSGBinParams, M: ManifoldModule): Manifold | null {
  if (!params.hasLip) return null

  const { Manifold } = M
  const { widthUnits, depthUnits, baseUnit, tolerance, heightUnits, unitHeight } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const hw = outerW / 2
  const hd = outerD / 2
  const totalH = heightUnits * unitHeight
  const maxLipInset = LIP_PROFILE[LIP_PROFILE.length - 1][0] // 2.6

  const grooveParts: Manifold[] = []

  for (let i = 0; i < LIP_PROFILE.length - 1; i++) {
    const [inset0, z0] = LIP_PROFILE[i]
    const [inset1, z1] = LIP_PROFILE[i + 1]

    // Inner face inset from outer wall at each profile height.
    // At bottom (inset=0): LIP_OFFSET + maxLipInset = 2.85mm (widest)
    // At top (inset=2.6): LIP_OFFSET + 0 = 0.25mm (thin tip)
    const innerInset0 = LIP_OFFSET + maxLipInset - inset0
    const innerInset1 = LIP_OFFSET + maxLipInset - inset1
    const r0 = Math.max(0.01, OUTER_CORNER_RADIUS - innerInset0)
    const r1 = Math.max(0.01, OUTER_CORNER_RADIUS - innerInset1)

    grooveParts.push(
      keep(
        Manifold.hull([
          ...ringAt(hw - innerInset0, hd - innerInset0, r0, 0, 0, totalH + z0),
          ...ringAt(hw - innerInset1, hd - innerInset1, r1, 0, 0, totalH + z1)
        ])
      )
    )
  }

  return keep(Manifold.union(grooveParts))
}

function subtractHoles(bin: Manifold, params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold } = M
  const { widthUnits, depthUnits, baseUnit, magnetHoles, screwHoles } = params

  const holeConfigs: Array<{ diameter: number; depth: number }> = []
  if (magnetHoles.enabled) {
    holeConfigs.push({ diameter: magnetHoles.diameter, depth: magnetHoles.depth })
  }
  if (screwHoles.enabled) {
    holeConfigs.push({ diameter: screwHoles.diameter, depth: screwHoles.depth })
  }
  if (holeConfigs.length === 0) return bin

  const cornerOffset = baseUnit / 2 - MAGNET_HOLE_OFFSET
  const holes: Manifold[] = []

  for (let gx = 0; gx < widthUnits; gx++) {
    for (let gy = 0; gy < depthUnits; gy++) {
      const ccx = baseUnit * (gx + 0.5 - widthUnits / 2)
      const ccy = baseUnit * (gy + 0.5 - depthUnits / 2)

      const positions = [
        [ccx - cornerOffset, ccy - cornerOffset],
        [ccx + cornerOffset, ccy - cornerOffset],
        [ccx + cornerOffset, ccy + cornerOffset],
        [ccx - cornerOffset, ccy + cornerOffset]
      ]

      for (const [hx, hy] of positions) {
        for (const { diameter, depth } of holeConfigs) {
          const cylinder = keep(
            Manifold.cylinder(depth, diameter / 2, diameter / 2, circleSegments(diameter / 2))
          )
          holes.push(keep(cylinder.translate([hx, hy, 0])))
        }
      }
    }
  }

  return keep(Manifold.difference(bin, keep(Manifold.union(holes))))
}

function subtractPockets(bin: Manifold, params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold, CrossSection } = M
  if (params.pockets.length === 0) return bin

  const cutters: Manifold[] = []

  for (const pocket of params.pockets) {
    const vertCount = pocket.vertices.length / 2
    if (vertCount < 3) continue

    const poly: Array<[number, number]> = []
    for (let i = 0; i < vertCount; i++) {
      poly.push([pocket.posX + pocket.vertices[i * 2], pocket.posY + pocket.vertices[i * 2 + 1]])
    }

    let cs = keep(new CrossSection([poly]))

    if (pocket.clearance > 0) {
      // The offset leaves pairs of points a few nanometers apart where a rounded corner
      // meets an edge. simplify() removes them, so they don't become zero-area triangles.
      const grown = keep(cs.offset(pocket.clearance, 'Round', 2, circleSegments(pocket.clearance)))
      cs = keep(grown.simplify(OFFSET_CLEANUP))
    }

    // Extend upward through the lip (+ 1mm overshoot) so edge pockets
    // cleanly cut the stacking lip with no residual sliver at the rim.
    const lipExtension = params.hasLip ? LIP_HEIGHT + 1 : 0
    const cutHeight = pocket.depth + lipExtension
    const cutBase = pocket.zTop - pocket.depth
    const prism = extrudeOutline(cs, cutHeight, M)
    cutters.push(keep(prism.translate([0, 0, cutBase])))
  }

  if (cutters.length === 0) return bin
  return keep(Manifold.difference(bin, keep(Manifold.union(cutters))))
}

// ─── Crease-Angle Normal Computation ─────────────────────────────

/**
 * Crease angle in degrees: edges where face normals differ by MORE than
 * this angle get hard/split normals. Edges below this threshold are smoothed.
 *
 * 30° means: 90° corners → hard edges, gentle curves → smooth.
 */
const CREASE_ANGLE_DEG = 30

/**
 * Compute per-face-vertex normals with crease-angle splitting.
 *
 * For each vertex in each triangle, we average the face normals of all
 * adjacent triangles whose face normal is within CREASE_ANGLE of this
 * triangle's face normal. This gives smooth normals on gradual curves
 * and hard edges on sharp corners — without needing Manifold's
 * calculateNormals (which may not work in all WASM bindings).
 *
 * Output is a non-indexed mesh (3 unique vertices per triangle) since
 * a single vertex position may need different normals for different faces.
 * `solidVertices` keeps the input index of each output vertex.
 */
function computeCreaseNormals(positions: Float32Array, indices: Uint32Array): CSGMeshResult {
  const triCount = indices.length / 3
  const cosThreshold = Math.cos((CREASE_ANGLE_DEG * Math.PI) / 180)

  // Step 1: Compute face normals
  const faceNormals = new Float32Array(triCount * 3)
  for (let f = 0; f < triCount; f++) {
    const i0 = indices[f * 3] * 3
    const i1 = indices[f * 3 + 1] * 3
    const i2 = indices[f * 3 + 2] * 3

    const ax = positions[i1] - positions[i0]
    const ay = positions[i1 + 1] - positions[i0 + 1]
    const az = positions[i1 + 2] - positions[i0 + 2]
    const bx = positions[i2] - positions[i0]
    const by = positions[i2 + 1] - positions[i0 + 1]
    const bz = positions[i2 + 2] - positions[i0 + 2]

    let nx = ay * bz - az * by
    let ny = az * bx - ax * bz
    let nz = ax * by - ay * bx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (len > 0) {
      nx /= len
      ny /= len
      nz /= len
    }

    faceNormals[f * 3] = nx
    faceNormals[f * 3 + 1] = ny
    faceNormals[f * 3 + 2] = nz
  }

  // Step 2: Build vertex → face adjacency
  const vertCount = positions.length / 3
  const vertFaces: number[][] = new Array(vertCount)
  for (let i = 0; i < vertCount; i++) vertFaces[i] = []

  for (let f = 0; f < triCount; f++) {
    vertFaces[indices[f * 3]].push(f)
    vertFaces[indices[f * 3 + 1]].push(f)
    vertFaces[indices[f * 3 + 2]].push(f)
  }

  // Step 3: For each vertex-in-face, average normals of compatible adjacent faces
  // Output as non-indexed mesh (3 vertices per triangle)
  const outVerts = triCount * 3
  const outPos = new Float32Array(outVerts * 3)
  const outNorm = new Float32Array(outVerts * 3)
  const outIdx = new Uint32Array(outVerts)
  const solidVertices = new Uint32Array(outVerts)

  for (let f = 0; f < triCount; f++) {
    const fnx = faceNormals[f * 3]
    const fny = faceNormals[f * 3 + 1]
    const fnz = faceNormals[f * 3 + 2]

    for (let v = 0; v < 3; v++) {
      const srcIdx = indices[f * 3 + v]
      const outI = f * 3 + v

      // Copy position
      outPos[outI * 3] = positions[srcIdx * 3]
      outPos[outI * 3 + 1] = positions[srcIdx * 3 + 1]
      outPos[outI * 3 + 2] = positions[srcIdx * 3 + 2]

      // Average normals of adjacent faces within crease angle
      let nx = 0
      let ny = 0
      let nz = 0
      for (const adjFace of vertFaces[srcIdx]) {
        const afx = faceNormals[adjFace * 3]
        const afy = faceNormals[adjFace * 3 + 1]
        const afz = faceNormals[adjFace * 3 + 2]
        const dot = fnx * afx + fny * afy + fnz * afz
        if (dot >= cosThreshold) {
          nx += afx
          ny += afy
          nz += afz
        }
      }
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) {
        nx /= len
        ny /= len
        nz /= len
      }

      outNorm[outI * 3] = nx
      outNorm[outI * 3 + 1] = ny
      outNorm[outI * 3 + 2] = nz

      outIdx[outI] = outI
      solidVertices[outI] = srcIdx
    }
  }

  return { positions: outPos, indices: outIdx, normals: outNorm, solidVertices }
}

/**
 * Corners this close on every axis are one corner, in mm. Positions are 32-bit, so at a few
 * hundred mm two values for the same point can differ by this much. It is a fiftieth of a
 * micron: nothing printable is lost.
 */
const SAME_POINT = 2e-5

/**
 * Where two parts of a solid met along a shared edge, the union can leave the corners of
 * both, in the same place, joined by triangles with no area. Join each such pair
 * into one corner and drop those triangles. Only corners already joined by an edge are
 * merged, so surfaces that merely touch stay separate.
 */
function collapseZeroLengthEdges(positions: Float32Array, indices: Uint32Array): Uint32Array {
  const standsFor = new Uint32Array(positions.length / 3).map((_, i) => i)
  const find = (v: number): number => {
    while (standsFor[v] !== v) {
      standsFor[v] = standsFor[standsFor[v]]
      v = standsFor[v]
    }
    return v
  }
  const samePlace = (a: number, b: number): boolean =>
    Math.abs(positions[a * 3] - positions[b * 3]) <= SAME_POINT &&
    Math.abs(positions[a * 3 + 1] - positions[b * 3 + 1]) <= SAME_POINT &&
    Math.abs(positions[a * 3 + 2] - positions[b * 3 + 2]) <= SAME_POINT

  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e]
      const b = indices[t + ((e + 1) % 3)]
      if (a !== b && samePlace(a, b))
        standsFor[Math.max(find(a), find(b))] = Math.min(find(a), find(b))
    }
  }

  const kept: number[] = []
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t])
    const b = find(indices[t + 1])
    const c = find(indices[t + 2])
    if (a !== b && b !== c && c !== a) kept.push(a, b, c)
  }
  return new Uint32Array(kept)
}

/** A triangle lower than this over its longest side has no area, in mm. */
const FLAT_HEIGHT = 1e-6

/** At most this many rounds of flipping. Each round clears the flat triangles it finds. */
const MAX_FLIP_ROUNDS = 16

/**
 * A union can also leave a triangle whose three corners are in a line: one corner sits on
 * the opposite side, between its ends. The triangle across that side is split at that
 * corner instead, which covers the same surface without the flat triangle.
 *
 *     u ───── w ───── v          u ───── w ───── v
 *      ╲             ╱     →      ╲      │      ╱
 *        ╲         ╱                ╲    │    ╱
 *             x                          x
 */
function flipFlatTriangles(positions: Float32Array, indices: Uint32Array): Uint32Array {
  const tris = Array.from(indices)
  const point = (v: number): [number, number, number] => [
    positions[v * 3],
    positions[v * 3 + 1],
    positions[v * 3 + 2]
  ]
  const distance = (a: number, b: number): number => {
    const [ax, ay, az] = point(a)
    const [bx, by, bz] = point(b)
    return Math.hypot(ax - bx, ay - by, az - bz)
  }
  /** For a flat triangle, which corner (0 to 2) starts its longest side. Otherwise -1. */
  const longestSideIfFlat = (t: number): number => {
    const sides = [0, 1, 2].map((e) => distance(tris[t + e], tris[t + ((e + 1) % 3)]))
    const longest = sides.indexOf(Math.max(...sides))
    const [a, b, c] = [point(tris[t]), point(tris[t + 1]), point(tris[t + 2])]
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const twiceArea = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]
    )
    return twiceArea < FLAT_HEIGHT * sides[longest] ? longest : -1
  }

  for (let round = 0; round < MAX_FLIP_ROUNDS; round++) {
    // Each side of a triangle, as "from>to", to the triangle and corner it starts at.
    const sideOf = new Map<string, number>()
    for (let t = 0; t < tris.length; t += 3) {
      for (let e = 0; e < 3; e++) sideOf.set(`${tris[t + e]}>${tris[t + ((e + 1) % 3)]}`, t + e)
    }

    const changed = new Set<number>()
    for (let t = 0; t < tris.length; t += 3) {
      if (changed.has(t)) continue
      const side = longestSideIfFlat(t)
      if (side === -1) continue
      const u = tris[t + side]
      const v = tris[t + ((side + 1) % 3)]
      const w = tris[t + ((side + 2) % 3)]
      // The triangle on the other side of the long side runs along it the other way.
      const across = sideOf.get(`${v}>${u}`)
      if (across === undefined) continue
      const n = across - (across % 3)
      if (changed.has(n) || n === t) continue
      // Several corners in one line make flat triangles side by side. Splitting one flat
      // triangle with another only moves the problem, so start from the one whose
      // neighbor has area. The rest follow in later rounds.
      if (longestSideIfFlat(n) !== -1) continue
      const x = tris[n + ((across - n + 2) % 3)]
      tris.splice(t, 3, w, u, x)
      tris.splice(n, 3, v, w, x)
      changed.add(t).add(n)
    }
    if (changed.size === 0) break
  }
  return new Uint32Array(tris)
}

// ─── Main Entry Point ────────────────────────────────────────────

/**
 * Build a complete Gridfinity bin as a manifold-valid CSG solid.
 *
 * Returns positions/indices/normals ready for Three.js BufferGeometry, and the solid's own
 * vertex for each of them so an export can stay closed.
 * Normals use crease-angle splitting: flat surfaces get hard edges,
 * rounded corners get smooth shading.
 */
export function buildBinCSG(params: CSGBinParams, manifoldModule: ManifoldModule): CSGMeshResult {
  const made: Disposable[] = []
  madeThisBake = made
  try {
    return meshOf(buildSolid(params, manifoldModule))
  } finally {
    // Also when the bake threw: what was made up to then is still on Manifold's heap.
    madeThisBake = null
    for (const item of made) item.delete()
  }
}

/** The finished bin as one solid. Everything it makes is noted with `keep`. */
function buildSolid(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold } = M

  // Step 1: Build base feet
  const feet = buildBaseFeet(params, M)

  // Step 2: Build everything above the feet, and join the two
  let bin = keep(Manifold.union([feet, buildTrunk(params, M)]))

  // Step 3: Subtract lip groove (the trunk extends through the lip; the groove carves it)
  const lipGroove = buildLipGroove(params, M)
  if (lipGroove) bin = keep(Manifold.difference(bin, lipGroove))

  // Step 4: Subtract magnet/screw holes
  bin = subtractHoles(bin, params, M)

  // Step 5: Subtract pockets (cut down from top surface)
  return subtractPockets(bin, params, M)
}

/** A solid's triangles, copied off Manifold's heap and ready for Three.js. */
function meshOf(bin: Manifold): CSGMeshResult {
  // Extract raw mesh from Manifold
  const mesh = bin.getMesh()
  const numProp = mesh.numProp
  const rawVertCount = mesh.vertProperties.length / numProp
  const rawPositions = new Float32Array(rawVertCount * 3)
  for (let i = 0; i < rawVertCount; i++) {
    const off = i * numProp
    rawPositions[i * 3] = mesh.vertProperties[off]
    rawPositions[i * 3 + 1] = mesh.vertProperties[off + 1]
    rawPositions[i * 3 + 2] = mesh.vertProperties[off + 2]
  }
  const rawIndices = flipFlatTriangles(
    rawPositions,
    collapseZeroLengthEdges(rawPositions, new Uint32Array(mesh.triVerts))
  )

  // Compute normals with crease-angle vertex splitting
  return computeCreaseNormals(rawPositions, rawIndices)
}
