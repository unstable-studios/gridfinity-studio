import { useEffect, useCallback, useRef } from 'react'
import { useLayoutEngine } from './useLayoutEngine'
import { useProject } from '@/hooks/useProject'
import type { LayoutSnapshotData } from '../../../shared/types/project'
import type { LayoutSnapshot } from './types'

/**
 * Runtime type guard for layout snapshot data loaded from project files.
 * Validates structural shape before passing to the engine.
 */
function isValidSnapshot(data: unknown): data is LayoutSnapshot {
  if (data === null || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.version !== 'string') return false
  if (!Array.isArray(obj.shapes) || !Array.isArray(obj.groups)) return false
  if (obj.gridConfig === null || typeof obj.gridConfig !== 'object') return false
  const gc = obj.gridConfig as Record<string, unknown>
  if (
    typeof gc.size !== 'number' ||
    typeof gc.enabled !== 'boolean' ||
    typeof gc.visible !== 'boolean'
  )
    return false
  return true
}

const SYNC_DEBOUNCE_MS = 1000

/**
 * Syncs the layout engine snapshot with the project store.
 *
 * Responsibilities:
 * - Before save: captures engine.toSnapshot() → project.layoutSnapshot
 *   via registerBeforeSave, so any save path gets current engine state.
 * - On mutation: debounce-syncs the snapshot to the project store so that
 *   sessionStorage always has a recent layout (survives page refresh).
 * - On mutation: marks the project as modified (isModified = true) so
 *   the "Unsaved" badge shows. Suppressed during project load to avoid
 *   false positives.
 * - After load: reads project.layoutSnapshot → engine.loadSnapshot()
 */
export function useProjectEngineSync(): void {
  const engine = useLayoutEngine()
  const { setLayoutSnapshot, registerBeforeSave } = useProject()
  const project = useProject((s) => s.project)
  const loadedProjectRef = useRef<string | null>(null)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // True during engine.loadSnapshot() calls triggered by project load.
  // Engine events fire synchronously during loadSnapshot, so this ref
  // suppresses the isModified flag for those events.
  const isRestoringRef = useRef(false)

  // On project load: restore engine state from layoutSnapshot.
  // Only runs when a NEW project is loaded (different createdAt), not on engine switches.
  // Engine switches preserve state via LayoutEngineContext's pendingStateRef.
  const projectId = project?.settings?.createdAt ?? null
  useEffect(() => {
    if (!engine || !project?.layoutSnapshot) return
    if (loadedProjectRef.current === projectId) return
    loadedProjectRef.current = projectId

    if (!isValidSnapshot(project.layoutSnapshot)) {
      console.warn('Invalid layout snapshot in project file — skipping restore')
      return
    }

    isRestoringRef.current = true
    engine.loadSnapshot(project.layoutSnapshot as unknown as LayoutSnapshot)
    isRestoringRef.current = false
  }, [engine, project?.layoutSnapshot, projectId])

  const captureSnapshot = useCallback((): void => {
    if (!engine) return
    const snapshot = engine.toSnapshot()
    // LayoutSnapshot → LayoutSnapshotData: structurally equivalent
    setLayoutSnapshot(snapshot as unknown as LayoutSnapshotData)
  }, [engine, setLayoutSnapshot])

  // Register snapshot capture as a before-save callback so ANY save path
  // (Navbar, keyboard shortcut, etc.) captures engine state automatically.
  useEffect(() => {
    return registerBeforeSave(captureSnapshot)
  }, [registerBeforeSave, captureSnapshot])

  // Debounce-sync engine state to project store on mutations so
  // sessionStorage always has a recent layout (survives page refresh).
  // Also mark project as modified unless we're restoring from a file load.
  useEffect(() => {
    if (!engine) return

    const onMutation = (): void => {
      // Mark as modified for user-initiated changes (not during project load).
      // Undo/redo also marks modified — the state differs from the saved file.
      if (!isRestoringRef.current) {
        useProject.setState({ isModified: true })
      }

      // Debounce the session snapshot sync
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(captureSnapshot, SYNC_DEBOUNCE_MS)
    }

    const unsubs = [
      engine.on('shapeCreated', onMutation),
      engine.on('shapeDeleted', onMutation),
      engine.on('shapeMoved', onMutation),
      engine.on('shapeResized', onMutation),
      engine.on('groupChanged', onMutation),
      engine.on('groupMoved', onMutation),
      engine.on('groupResized', onMutation)
    ]

    return () => {
      unsubs.forEach((u) => u())
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [engine, captureSnapshot])
}
