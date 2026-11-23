/**
 * Bake loop: watches the LayoutEngine for changes, converts each bin + its
 * child shapes into CSG params, dispatches `bakePockets` to the geometry
 * worker, and stores the resulting mesh in `useProject.bakeResults` keyed by
 * bin id. The Preview canvas reads from `bakeResults` and renders.
 *
 * Mounted once at the App level inside LayoutEngineProvider.
 *
 * - Debounced: small edits in rapid succession only trigger one bake per bin.
 * - Per-bin in-flight tracking with explicit `bakeStatus` (idle/baking/ready/
 *   error) so the UI can distinguish "stale-but-rebaking" from "ready".
 * - If a mutation lands during a bake, the in-flight bake completes and a
 *   follow-up bake starts as soon as it settles, whether it succeeded or
 *   failed (no edits dropped). `BakeQueue` owns that bookkeeping.
 * - On bake failure, status becomes 'error' so UI can surface it and disable
 *   export.
 * - Cleans up results when bins are deleted, and ignores a bake that was
 *   still running for a deleted bin.
 * - `enabled` gates new bakes — caller passes `mode === 'review'` so we don't
 *   burn CPU baking while the user is editing in Layout mode.
 */
import { useEffect, useRef } from 'react'
import { useLayoutEngine, useEngineState } from '@/layout-engine'
import { isBinGroup } from '@/layout-engine/types'
import type { LayoutGroup, LayoutShape, BinMetadata } from '@/layout-engine/types'
import { useGeometryWorker } from './useGeometryWorker'
import type { BakePocketsResult } from './useGeometryWorker'
import { BakeQueue } from '@/lib/bake-queue'
import { useProject } from './useProject'
import type { CSGBinParams, PocketSpec } from '../../../shared/types/worker'
import type { GridfinityConfig } from '../../../shared/types/project'
import { computeDefaultPocketDepth, DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'

const DEBOUNCE_MS = 200
const CIRCLE_SEGMENTS = 32
const DEFAULT_CLEARANCE = 0.25

/**
 * Convert a 2D LayoutShape into pocket-local vertex array (Float32Array of
 * [x0,y0,x1,y1,...]). Coordinates are centered at the shape's origin (the
 * pocket's posX/posY positions the shape on the bin).
 *
 * Output is in math y-up convention (Manifold/CrossSection convention).
 * Editor y is screen-y-down; for shapes built from editor input (polygon),
 * flip y on the way out.
 */
function shapeToPocketVertices(shape: LayoutShape): Float32Array | null {
  switch (shape.type) {
    case 'rect': {
      const hw = shape.width / 2
      const hh = shape.height / 2
      // CCW in math y-up: bottom-left → bottom-right → top-right → top-left.
      // Rect is symmetric, so the editor-y-flip we do for posY doesn't apply
      // to its vertices.
      return new Float32Array([-hw, -hh, hw, -hh, hw, hh, -hw, hh])
    }
    case 'circle': {
      // CCW in math y-up by construction (sin goes positive for small
      // positive angles). Symmetric around origin so no editor-y flip.
      const verts = new Float32Array(CIRCLE_SEGMENTS * 2)
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2
        verts[i * 2] = shape.radiusX * Math.cos(angle)
        verts[i * 2 + 1] = shape.radiusY * Math.sin(angle)
      }
      return verts
    }
    case 'polygon': {
      const pts = shape.points
      if (pts.length < 3) return null
      // Polygon vertices come from the editor (screen-y-down) — flip y on
      // the way out so the polygon ends up in math y-up convention,
      // matching the rect/circle output. Mirroring across X reverses
      // winding, so reuse the post-flip vertices for the area test.
      const flipped = pts.map((p) => ({ x: p.x, y: -p.y }))
      let area2 = 0
      for (let i = 0; i < flipped.length; i++) {
        const a = flipped[i]
        const b = flipped[(i + 1) % flipped.length]
        area2 += a.x * b.y - b.x * a.y
      }
      // Manifold's CrossSection treats CW polygons as inverted ("everything
      // outside"); subtracting that from the bin would wipe all visible
      // geometry. Reverse iteration when the polygon comes out CW so the
      // cutter is always a valid filled region.
      const reverse = area2 < 0
      const verts = new Float32Array(flipped.length * 2)
      for (let i = 0; i < flipped.length; i++) {
        const src = reverse ? flipped[flipped.length - 1 - i] : flipped[i]
        verts[i * 2] = src.x
        verts[i * 2 + 1] = src.y
      }
      return verts
    }
    case 'svgPath':
    case 'meshImport':
      // Out of scope for MVP — would need path tessellation / mesh import.
      return null
  }
}

interface ShapePocketMetadata {
  pocket?: { depth: number; clearance: number }
}

function buildBinParams(
  bin: LayoutGroup & { metadata: BinMetadata },
  childShapes: LayoutShape[],
  config: GridfinityConfig
): CSGBinParams {
  const totalH = bin.metadata.heightUnits * config.unitHeight
  const pockets: PocketSpec[] = []

  for (const shape of childShapes) {
    const verts = shapeToPocketVertices(shape)
    if (!verts) continue

    const meta = shape.metadata as ShapePocketMetadata | undefined
    const depth =
      meta?.pocket?.depth ?? computeDefaultPocketDepth(bin.metadata.heightUnits, config.unitHeight)
    const clearance = meta?.pocket?.clearance ?? DEFAULT_CLEARANCE

    pockets.push({
      vertices: verts,
      depth,
      clearance,
      // The CSG builder works in math y-up (positive cy = "back" of the bin
      // in slicer convention), but the editor stores shape.y in screen-y-down
      // convention (small y = "top of design"). Flip the Y sign at the
      // boundary so a shape drawn at the top of the design lands at the
      // back of the bin in 3D, not the front. Vertex Y is normalized
      // separately in shapeToPocketVertices.
      posX: shape.x,
      posY: -shape.y,
      zTop: totalH
    })
  }

  return {
    widthUnits: bin.metadata.widthUnits,
    depthUnits: bin.metadata.depthUnits,
    heightUnits: bin.metadata.heightUnits,
    baseUnit: config.baseUnit,
    unitHeight: config.unitHeight,
    tolerance: config.tolerance,
    hasLip: bin.metadata.hasLip,
    magnetHoles: config.magnetHoles,
    screwHoles: config.screwHoles,
    pockets
  }
}

/**
 * Mounts the bake loop. Returns nothing — it's a side-effect hook.
 */
export function useBinBaker(enabled: boolean): void {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const { ready, bakePockets } = useGeometryWorker()
  const gridfinity = useProject((s) => s.project?.gridfinity)

  // Bin IDs we've previously baked, to detect deletions.
  const lastSeenBinIdsRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<BakeQueue<BakePocketsResult> | null>(null)

  useEffect(() => {
    if (!engine) return
    queueRef.current = new BakeQueue<BakePocketsResult>({
      // Reads the engine and settings when the bake starts: a queued bake can
      // start long after the edit that requested it.
      bake: (binId) => {
        const bin = engine.getGroup(binId)
        if (!bin || !isBinGroup(bin)) return null
        const childShapes = engine.getAllShapes().filter((s) => s.groupId === binId)
        const config = useProject.getState().project?.gridfinity ?? DEFAULT_GRIDFINITY_CONFIG
        return bakePockets(buildBinParams(bin, childShapes, config))
      },
      onStart: (binId) => useProject.getState().setBakeStatus(binId, 'baking'),
      onDone: (binId, result) => {
        const { setBakeResult, setBakeStatus } = useProject.getState()
        setBakeResult(binId, { mesh: result, timestamp: Date.now(), warnings: result.warnings })
        setBakeStatus(binId, 'ready')
      },
      onError: (binId, err) => {
        useProject.getState().setBakeStatus(binId, 'error')
        console.error(`[useBinBaker] bake failed for ${binId}:`, err)
      }
    })
    return () => {
      queueRef.current = null
    }
  }, [engine, bakePockets])

  useEffect(() => {
    if (!engine || !ready || !enabled) return

    const handle = setTimeout(() => {
      const queue = queueRef.current
      if (!queue) return
      const liveBinIds = new Set<string>()
      for (const group of engine.getAllGroups()) {
        if (!isBinGroup(group)) continue
        liveBinIds.add(group.id)
        queue.request(group.id)
      }

      // Drop bake state for bins that no longer exist
      const { setBakeResult, setBakeStatus } = useProject.getState()
      for (const id of lastSeenBinIdsRef.current) {
        if (!liveBinIds.has(id)) {
          queue.forget(id)
          setBakeResult(id, null)
          setBakeStatus(id, null)
        }
      }
      lastSeenBinIdsRef.current = liveBinIds
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [tick, engine, ready, enabled, gridfinity])
}
