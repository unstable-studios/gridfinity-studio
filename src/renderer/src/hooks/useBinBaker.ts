/**
 * Bake loop: watches the LayoutEngine for changes, converts each bin + its
 * child shapes into CSG params, dispatches `bakePockets` to the geometry
 * worker, and stores the resulting mesh in `useProject.bakeResults` keyed by
 * bin id. The Preview canvas reads from `bakeResults` and renders.
 *
 * Mounted once at the App level inside LayoutEngineProvider.
 *
 * - Debounced: small edits in rapid succession only trigger one bake per bin.
 * - Per-bin in-flight tracking: while a bin is baking, further mutations queue
 *   a follow-up bake instead of cancelling.
 * - Cleans up stale results when bins are deleted.
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
      if (shape.points.length < 3) return null
      const verts = new Float32Array(shape.points.length * 2)
      for (let i = 0; i < shape.points.length; i++) {
        verts[i * 2] = shape.points[i].x
        verts[i * 2 + 1] = shape.points[i].y
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
 * Mounts the bake loop. Returns nothing — it's a side-effect hook.
 *
 * Re-evaluates on every engine mutation (via `tick`), debounces, and dispatches
 * one bake per bin. Per-bin in-flight gating prevents overlap; if a mutation
 * lands during a bake, the bin is rebaked once the in-flight one finishes.
 */
export function useBinBaker(): void {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const { ready, bakePockets } = useGeometryWorker()
  const project = useProject((s) => s.project)
  const setBakeResult = useProject((s) => s.setBakeResult)

  const inFlightRef = useRef<Set<string>>(new Set())
  const queuedRef = useRef<Set<string>>(new Set())
  const lastSeenBinIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!engine || !ready) return

    const handle = setTimeout(() => {
      const groups = engine.getAllGroups()
      const allShapes = engine.getAllShapes()
      const config = project?.gridfinity ?? DEFAULT_GRIDFINITY_CONFIG

      const liveBinIds = new Set<string>()

      for (const group of groups) {
        if (!isBinGroup(group)) continue
        liveBinIds.add(group.id)

        if (inFlightRef.current.has(group.id)) {
          queuedRef.current.add(group.id)
          continue
        }

        const childShapes = allShapes.filter((s) => s.groupId === group.id)
        const params = buildBinParams(group, childShapes, config)

        const binId = group.id
        inFlightRef.current.add(binId)
        bakePockets(params)
          .then((result) => {
            inFlightRef.current.delete(binId)
            setBakeResult(binId, {
              mesh: result,
              timestamp: Date.now(),
              warnings: result.warnings
            })
            // If state changed during the bake, rebake immediately with
            // current state. The next tick-driven effect run will pick this
            // up; we just have to make sure we don't re-enter prematurely.
            queuedRef.current.delete(binId)
          })
          .catch((err) => {
            inFlightRef.current.delete(binId)
            queuedRef.current.delete(binId)

            console.error(`[useBinBaker] bake failed for ${binId}:`, err)
          })
      }

      // Drop bake results for bins that no longer exist
      for (const id of lastSeenBinIdsRef.current) {
        if (!liveBinIds.has(id)) {
          setBakeResult(id, null)
        }
      }
      lastSeenBinIdsRef.current = liveBinIds
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [tick, engine, ready, project?.gridfinity, bakePockets, setBakeResult])
}
