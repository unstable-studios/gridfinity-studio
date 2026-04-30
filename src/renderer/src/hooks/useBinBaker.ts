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
 *   follow-up bake is chained immediately on resolve (no edits dropped).
 * - On bake failure, status becomes 'error' so UI can surface it and disable
 *   export.
 * - Cleans up stale results when bins are deleted.
 * - `enabled` gates new bakes — caller passes `mode === 'review'` so we don't
 *   burn CPU baking while the user is editing in Layout mode.
 */
import { useEffect, useRef } from 'react'
import { useLayoutEngine, useEngineState } from '@/layout-engine'
import { isBinGroup } from '@/layout-engine/types'
import type { LayoutGroup, LayoutShape, BinMetadata } from '@/layout-engine/types'
import { useGeometryWorker } from './useGeometryWorker'
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
 */
function shapeToPocketVertices(shape: LayoutShape): Float32Array | null {
  switch (shape.type) {
    case 'rect': {
      const hw = shape.width / 2
      const hh = shape.height / 2
      // CCW from bottom-left in editor screen-y-down convention
      return new Float32Array([-hw, -hh, hw, -hh, hw, hh, -hw, hh])
    }
    case 'circle': {
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
      // Manifold's CrossSection treats CCW polygons as filled regions and
      // CW polygons as inverted ("everything outside"). Our editor lets the
      // user click vertices in either direction; if a polygon ends up CW in
      // math coords (≈ CCW on screen, since editor y is screen-down), the
      // cutter solid would engulf the whole bin and subtraction would
      // delete every visible part of the geometry.
      //
      // Detect winding via shoelace (positive = CCW in math y-up) and
      // reverse the order when needed so the pocket is always a valid
      // filled region.
      let area2 = 0
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        area2 += a.x * b.y - b.x * a.y
      }
      const reverse = area2 < 0
      const verts = new Float32Array(pts.length * 2)
      for (let i = 0; i < pts.length; i++) {
        const src = reverse ? pts[pts.length - 1 - i] : pts[i]
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
      // shape.x/y is bin-local since shape.groupId === bin.id. Editor uses
      // y-down (screen) and so does the CSG builder's CrossSection (looking
      // at the bin from above, +y = "down" the depth axis), so no flip.
      posX: shape.x,
      posY: shape.y,
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
 * Group child shapes by their `groupId` once, instead of running an
 * O(shapes) filter per bin every time the loop fires.
 */
function indexShapesByGroup(shapes: LayoutShape[]): Map<string, LayoutShape[]> {
  const idx = new Map<string, LayoutShape[]>()
  for (const s of shapes) {
    if (!s.groupId) continue
    const list = idx.get(s.groupId)
    if (list) list.push(s)
    else idx.set(s.groupId, [s])
  }
  return idx
}

/**
 * Mounts the bake loop. Returns nothing — it's a side-effect hook.
 */
export function useBinBaker(enabled: boolean): void {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const { ready, bakePockets } = useGeometryWorker()
  const project = useProject((s) => s.project)
  const setBakeResult = useProject((s) => s.setBakeResult)
  const setBakeStatus = useProject((s) => s.setBakeStatus)

  // Bin IDs whose latest dispatched bake hasn't resolved yet.
  const inFlightRef = useRef<Set<string>>(new Set())
  // Bin IDs that received a mutation while in-flight; rebaked on completion.
  const queuedRef = useRef<Set<string>>(new Set())
  // Bin IDs we've previously baked, to detect deletions.
  const lastSeenBinIdsRef = useRef<Set<string>>(new Set())
  // Stable refs to the bake function and store setters so the closure inside
  // the in-flight resolution path doesn't capture stale values.
  const bakePocketsRef = useRef(bakePockets)
  const setBakeResultRef = useRef(setBakeResult)
  const setBakeStatusRef = useRef(setBakeStatus)
  bakePocketsRef.current = bakePockets
  setBakeResultRef.current = setBakeResult
  setBakeStatusRef.current = setBakeStatus

  useEffect(() => {
    if (!engine || !ready || !enabled) return

    const handle = setTimeout(() => {
      const groups = engine.getAllGroups()
      const allShapes = engine.getAllShapes()
      const config = project?.gridfinity ?? DEFAULT_GRIDFINITY_CONFIG
      const shapesByGroup = indexShapesByGroup(allShapes)

      const liveBinIds = new Set<string>()

      for (const group of groups) {
        if (!isBinGroup(group)) continue
        liveBinIds.add(group.id)

        if (inFlightRef.current.has(group.id)) {
          // Mark for follow-up rebake; the in-flight resolver will pick it up.
          queuedRef.current.add(group.id)
          continue
        }

        scheduleBake(group, shapesByGroup.get(group.id) ?? [], config)
      }

      // Drop bake state for bins that no longer exist
      for (const id of lastSeenBinIdsRef.current) {
        if (!liveBinIds.has(id)) {
          setBakeResultRef.current(id, null)
          setBakeStatusRef.current(id, null)
          inFlightRef.current.delete(id)
          queuedRef.current.delete(id)
        }
      }
      lastSeenBinIdsRef.current = liveBinIds
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)

    function scheduleBake(
      bin: LayoutGroup & { metadata: BinMetadata },
      childShapes: LayoutShape[],
      cfg: GridfinityConfig
    ): void {
      const binId = bin.id
      const params = buildBinParams(bin, childShapes, cfg)
      inFlightRef.current.add(binId)
      setBakeStatusRef.current(binId, 'baking')

      bakePocketsRef
        .current(params)
        .then((result) => {
          inFlightRef.current.delete(binId)
          setBakeResultRef.current(binId, {
            mesh: result,
            timestamp: Date.now(),
            warnings: result.warnings
          })
          setBakeStatusRef.current(binId, 'ready')
          // If the bin was edited while we were baking, rebake immediately
          // with the latest engine state. Otherwise the edit would only get
          // picked up on the next unrelated tick.
          if (queuedRef.current.delete(binId) && engine) {
            const next = engine.getGroup(binId)
            if (next && isBinGroup(next)) {
              const nextShapes = engine.getAllShapes().filter((s) => s.groupId === binId)
              scheduleBake(next, nextShapes, cfg)
            }
          }
        })
        .catch((err) => {
          inFlightRef.current.delete(binId)
          queuedRef.current.delete(binId)
          setBakeStatusRef.current(binId, 'error')

          console.error(`[useBinBaker] bake failed for ${binId}:`, err)
        })
    }
  }, [tick, engine, ready, enabled, project?.gridfinity])
}
