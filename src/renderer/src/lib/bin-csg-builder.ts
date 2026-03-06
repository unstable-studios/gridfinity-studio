/**
 * CSG-first Gridfinity bin builder using Manifold primitives.
 *
 * Builds a proper manifold-valid solid via boolean operations:
 *   union(feet, bridge, body) - difference(cavity) - difference(lip groove) - difference(holes) - difference(pockets)
 *
 * The approach mirrors gridfinity-rebuilt-openscad:
 *   sweepRoundedRect() = sweep a 2D profile around a rounded rectangular path
 *   by extruding straight edges and revolving corners.
 *
 * All dimensions in millimetres. Returns positions/indices/normals ready for Three.js.
 */

import { BASE_PROFILE_HEIGHT, LIP_PROFILE, LIP_OFFSET } from './bin-generator'

// ─── Gridfinity Spec Constants ───────────────────────────────────

/** Per-unit base profile: [inset_from_outer_edge, height_from_bottom] */
const BASE_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.8, 0.8],
  [0.8, 2.6],
  [2.95, 4.95]
]

const OUTER_CORNER_RADIUS = 3.75
const BASE_BRIDGE_HEIGHT = 7 - BASE_PROFILE_HEIGHT // 2.05
const BASE_HEIGHT = 7
const MAGNET_HOLE_OFFSET = 8
const HOLE_SEGMENTS = 24

/** Arc resolution for rounded rect corners (higher = smoother) */
const CORNER_SEGMENTS = 16

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
}

// ─── Manifold type aliases (avoid importing manifold-3d types) ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ManifoldModule = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Manifold = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrossSection = any

// ─── Rounded Rectangle CrossSection ─────────────────────────────

/**
 * Build a rounded rectangle polygon (CCW) as an array of [x,y] points.
 * hw/hd = half-width/half-depth of the rectangle.
 * cornerRadius is clamped to fit within the rectangle.
 */
function roundedRectPolygon(
  hw: number,
  hd: number,
  cornerRadius: number,
  segments: number = CORNER_SEGMENTS
): Array<[number, number]> {
  const r = Math.min(Math.max(0, cornerRadius), hw, hd)
  const points: Array<[number, number]> = []

  // Four corners CCW: top-right, top-left, bottom-left, bottom-right
  const corners: Array<{ cx: number; cy: number; startAngle: number }> = [
    { cx: hw - r, cy: hd - r, startAngle: 0 },
    { cx: -(hw - r), cy: hd - r, startAngle: Math.PI / 2 },
    { cx: -(hw - r), cy: -(hd - r), startAngle: Math.PI },
    { cx: hw - r, cy: -(hd - r), startAngle: (3 * Math.PI) / 2 }
  ]

  for (const { cx, cy, startAngle } of corners) {
    for (let i = 0; i <= segments; i++) {
      // Include endpoint of each arc except the last corner's last point (closes naturally)
      if (i === segments) continue // next corner's i=0 covers this
      const angle = startAngle + (i / segments) * (Math.PI / 2)
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
    }
  }

  return points
}

/** Create a Manifold CrossSection from a rounded rectangle */
function roundedRectCS(
  hw: number,
  hd: number,
  cornerRadius: number,
  CSConstructor: CrossSection,
  segments: number = CORNER_SEGMENTS
): CrossSection {
  const poly = roundedRectPolygon(hw, hd, cornerRadius, segments)
  return new CSConstructor([poly])
}

// ─── Build Steps ─────────────────────────────────────────────────

function buildBaseFeet(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold, CrossSection } = M
  const { widthUnits, depthUnits, baseUnit, tolerance } = params

  // Per-unit cell half-size
  const cellHW = baseUnit / 2 - tolerance
  const cellHD = baseUnit / 2 - tolerance

  // Base profile polygon (closed, for sweep):
  // The profile is [radialOffset, height] from the corner center outward.
  // BASE_PROFILE gives [inset_from_outer_edge, height].
  // For sweep, radial offset = cornerRadius + (maxInset - inset) where we measure from center.
  // Actually, the profile polygon for sweepRoundedRect maps:
  //   X = distance from the path centerline (the rounded rect path)
  //   Y = height
  // The path is at cornerRadius from the center, so:
  //   profile X = 0 means ON the path = cornerRadius from center
  //   profile X = positive means outward from path
  //
  // For the base foot, the rounded rect path runs at BASE_BOTTOM_RADIUS from center.
  // The base profile starts at the path (X=0) and grows outward.
  // BASE_PROFILE[i] = [inset, height]: at height, the outer surface is at (maxInset - inset) from the path.
  // Wait — the profile needs to be a closed polygon for the cross section.

  // Let me reconsider. The base foot is a solid shape. We can build it as:
  // For each profile step, create a rounded-rect extrusion, then union them.
  // This is simpler and more reliable than sweep.

  const feet: Manifold[] = []
  const maxInset = BASE_PROFILE[BASE_PROFILE.length - 1][0] // 2.95

  for (let gx = 0; gx < widthUnits; gx++) {
    for (let gy = 0; gy < depthUnits; gy++) {
      const ccx = baseUnit * (gx + 0.5 - widthUnits / 2)
      const ccy = baseUnit * (gy + 0.5 - depthUnits / 2)

      // Build the foot as stacked extrusions between each profile step
      // At each step, the foot extends from the centerline to (maxInset - inset) from the outer edge.
      // cellHW is the half-width of the cell. The outer edge is at cellHW.
      // At a given inset, the ring is at cellHW - (maxInset - inset) = cellHW - maxInset + inset
      // Corner radius at a given inset: OUTER_CORNER_RADIUS - (maxInset - inset)

      // Build each segment between profile steps
      for (let i = 0; i < BASE_PROFILE.length - 1; i++) {
        const [inset0, z0] = BASE_PROFILE[i]
        const [inset1, z1] = BASE_PROFILE[i + 1]

        // The larger ring (at the higher profile step) defines the outer boundary
        // The smaller ring (at the lower step) defines the inner boundary
        // We extrude the larger cross-section for this height band, then
        // subtract the complement if needed.
        // Actually, since each step has a different inset, we need a frustum.
        // Manifold doesn't have frustum directly, but we can hull between two cross sections.

        // Simpler approach: build each profile segment as a solid slab at the LARGER size,
        // then intersect with a solid slab at the SMALLER size to create the step.
        // Actually simplest: just extrude each step's cross section for its height band,
        // then union. This creates a stepped profile (no angled chamfer), but it's a start.
        // For true chamfers we'd need hull or sweep.

        // Use Manifold.hull to create the frustum between two cross sections
        // Hull of two planar solids at different Z creates the chamfer

        const hw0 = cellHW - maxInset + inset0
        const hd0 = cellHD - maxInset + inset0
        const r0 = Math.max(0.01, OUTER_CORNER_RADIUS - maxInset + inset0)

        const hw1 = cellHW - maxInset + inset1
        const hd1 = cellHD - maxInset + inset1
        const r1 = Math.max(0.01, OUTER_CORNER_RADIUS - maxInset + inset1)

        // Create thin discs at z0 and z1 with respective cross sections, then hull
        const epsilon = 0.001
        const cs0 = roundedRectCS(hw0, hd0, r0, CrossSection)
        const cs1 = roundedRectCS(hw1, hd1, r1, CrossSection)

        const disc0 = Manifold.extrude(cs0, epsilon).translate([ccx, ccy, z0])
        const disc1 = Manifold.extrude(cs1, epsilon).translate([ccx, ccy, z1])

        const segment = Manifold.hull(disc0, disc1)
        feet.push(segment)
      }
    }
  }

  // Union all feet
  return Manifold.union(feet)
}

function buildBridge(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold, CrossSection } = M
  const { widthUnits, depthUnits, baseUnit, tolerance } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const hw = outerW / 2
  const hd = outerD / 2

  const cs = roundedRectCS(hw, hd, OUTER_CORNER_RADIUS, CrossSection)
  return Manifold.extrude(cs, BASE_BRIDGE_HEIGHT).translate([0, 0, BASE_PROFILE_HEIGHT])
}

function buildBody(params: CSGBinParams, M: ManifoldModule): Manifold {
  const { Manifold, CrossSection } = M
  const { widthUnits, depthUnits, baseUnit, tolerance, heightUnits, unitHeight } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const hw = outerW / 2
  const hd = outerD / 2
  const totalH = heightUnits * unitHeight

  // Solid block from BASE_HEIGHT to totalH only.
  // The lip (if enabled) is added separately as an annular rim.
  const bodyHeight = totalH - BASE_HEIGHT
  if (bodyHeight <= 0) {
    const cs = roundedRectCS(hw, hd, OUTER_CORNER_RADIUS, CrossSection)
    return Manifold.extrude(cs, 0.01).translate([0, 0, BASE_HEIGHT])
  }

  const cs = roundedRectCS(hw, hd, OUTER_CORNER_RADIUS, CrossSection)
  return Manifold.extrude(cs, bodyHeight).translate([0, 0, BASE_HEIGHT])
}

/**
 * Build the stacking lip as a tapered annular rim on top of the solid block.
 *
 * The lip's inner face follows the LIP_PROFILE (the groove receiving surface):
 *   - At the bottom (z=totalH): inner face at 2.85mm from outer (widest)
 *   - At the top (z=totalH+LIP_HEIGHT): inner face at 0.25mm from outer (thin "point")
 *
 * Built by hulling annular ring discs between each profile step.
 * No separate groove subtraction needed — the lip shape IS the groove interface.
 */
function buildLip(params: CSGBinParams, M: ManifoldModule): Manifold | null {
  if (!params.hasLip) return null

  const { Manifold, CrossSection } = M
  const { widthUnits, depthUnits, baseUnit, tolerance, heightUnits, unitHeight } = params

  const outerW = widthUnits * baseUnit - tolerance * 2
  const outerD = depthUnits * baseUnit - tolerance * 2
  const hw = outerW / 2
  const hd = outerD / 2
  const totalH = heightUnits * unitHeight
  const maxLipInset = LIP_PROFILE[LIP_PROFILE.length - 1][0] // 2.6

  const epsilon = 0.001
  const lipParts: Manifold[] = []

  for (let i = 0; i < LIP_PROFILE.length - 1; i++) {
    const [inset0, z0] = LIP_PROFILE[i]
    const [inset1, z1] = LIP_PROFILE[i + 1]

    // Inner face inset from outer wall at each profile height.
    // At bottom (inset=0): LIP_OFFSET + maxLipInset = 2.85mm (widest lip body)
    // At top (inset=2.6): LIP_OFFSET + 0 = 0.25mm (thin "point")
    const innerInset0 = LIP_OFFSET + maxLipInset - inset0
    const innerInset1 = LIP_OFFSET + maxLipInset - inset1

    // Outer ring (constant: the outer wall)
    const outerCS = roundedRectCS(hw, hd, OUTER_CORNER_RADIUS, CrossSection)
    const outerDisc0 = Manifold.extrude(outerCS, epsilon).translate([0, 0, totalH + z0])
    const outerDisc1 = Manifold.extrude(outerCS, epsilon).translate([0, 0, totalH + z1])
    const outerHull = Manifold.hull(outerDisc0, outerDisc1)

    // Inner ring (tapers with profile)
    const iHW0 = hw - innerInset0
    const iHD0 = hd - innerInset0
    const iR0 = Math.max(0.01, OUTER_CORNER_RADIUS - innerInset0)
    const iHW1 = hw - innerInset1
    const iHD1 = hd - innerInset1
    const iR1 = Math.max(0.01, OUTER_CORNER_RADIUS - innerInset1)

    const innerCS0 = roundedRectCS(iHW0, iHD0, iR0, CrossSection)
    const innerCS1 = roundedRectCS(iHW1, iHD1, iR1, CrossSection)
    const innerDisc0 = Manifold.extrude(innerCS0, epsilon).translate([0, 0, totalH + z0])
    const innerDisc1 = Manifold.extrude(innerCS1, epsilon).translate([0, 0, totalH + z1])
    const innerHull = Manifold.hull(innerDisc0, innerDisc1)

    // Lip segment = outer frustum minus inner frustum = tapered annular ring
    lipParts.push(Manifold.difference(outerHull, innerHull))
  }

  return Manifold.union(lipParts)
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
          const hole = Manifold.cylinder(
            depth,
            diameter / 2,
            diameter / 2,
            HOLE_SEGMENTS
          ).translate([hx, hy, 0])
          holes.push(hole)
        }
      }
    }
  }

  return Manifold.difference(bin, Manifold.union(holes))
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

    let cs = new CrossSection([poly])

    if (pocket.clearance > 0) {
      cs = cs.offset(pocket.clearance)
    }

    const solid = Manifold.extrude(cs, pocket.depth).translate([0, 0, pocket.zTop - pocket.depth])
    cutters.push(solid)
  }

  if (cutters.length === 0) return bin
  return Manifold.difference(bin, Manifold.union(cutters))
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
 */
function computeCreaseNormals(
  positions: Float32Array,
  indices: Uint32Array
): { positions: Float32Array; indices: Uint32Array; normals: Float32Array } {
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
    }
  }

  return { positions: outPos, indices: outIdx, normals: outNorm }
}

// ─── Main Entry Point ────────────────────────────────────────────

/**
 * Build a complete Gridfinity bin as a manifold-valid CSG solid.
 *
 * Returns positions/indices/normals ready for Three.js BufferGeometry.
 * Normals use crease-angle splitting: flat surfaces get hard edges,
 * rounded corners get smooth shading.
 */
export function buildBinCSG(params: CSGBinParams, manifoldModule: ManifoldModule): CSGMeshResult {
  const M = manifoldModule
  const { Manifold } = M

  // Step 1: Build base feet
  const feet = buildBaseFeet(params, M)

  // Step 2: Build bridge
  const bridge = buildBridge(params, M)

  // Step 3: Build body
  const body = buildBody(params, M)

  // Step 4: Union all solid parts
  const solidParts = [feet, bridge, body]

  // Step 5: Add lip rim (annular wall on top of the solid block)
  const lip = buildLip(params, M)
  if (lip) solidParts.push(lip)

  let bin = Manifold.union(solidParts)

  // Step 6: Subtract magnet/screw holes
  bin = subtractHoles(bin, params, M)

  // Step 7: Subtract pockets (cut down from top surface)
  bin = subtractPockets(bin, params, M)

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
  const rawIndices = new Uint32Array(mesh.triVerts)

  // Compute normals with crease-angle vertex splitting
  return computeCreaseNormals(rawPositions, rawIndices)
}
