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
import { useGeometryWorker } from './useGeometryWorker'
import type { BakePocketsResult } from './useGeometryWorker'
import { BakeQueue } from '@/lib/bake-queue'
import { buildBinParams } from '@/lib/bin-params'
import { useProject } from './useProject'
import { DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'

const DEBOUNCE_MS = 200

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
