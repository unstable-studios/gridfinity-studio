import { useEffect, useCallback, useRef } from 'react'
import { useLayoutEngine } from './useLayoutEngine'
import { useProject } from '@/hooks/useProject'
import { useUndoRedo } from '@/hooks/useUndoRedo'
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

/**
 * Syncs the layout engine snapshot with the project store.
 *
 * Responsibilities:
 * - Before save: captures engine.toSnapshot() → project.layoutSnapshot
 *   via registerBeforeSave, so any save path gets current engine state.
 * - On mutation: immediately syncs the snapshot to the project store so
 *   sessionStorage always has the latest layout (survives page refresh).
 * - On mutation: marks the project as modified (isModified = true) so
 *   the "Unsaved" badge shows. Suppressed during project load to avoid
 *   false positives.
 * - After load: reads project.layoutSnapshot → engine.loadSnapshot(), with the
 *   grid at the project's base unit, then resets the undo history
 *
 * Call it from a component that stays mounted: the restore resets the undo history, and a
 * remount would run it again (it remembers what it loaded in a ref).
 */
export function useProjectEngineSync(): void {
  const engine = useLayoutEngine()
  const { setLayoutSnapshot, registerBeforeSave } = useProject()
  const project = useProject((s) => s.project)
  const loadId = useProject((s) => s.loadId)
  const loadedLoadIdRef = useRef<number | null>(null)

  // True during engine.loadSnapshot() calls triggered by project load.
  // Engine events fire synchronously during loadSnapshot, so this ref
  // suppresses the isModified flag for those events.
  const isRestoringRef = useRef(false)

  // On project load: restore engine state from layoutSnapshot.
  // Runs once per load (#598): a project is not identified by `settings.createdAt`, which
  // opening the same file again, or a Save as copy, leaves unchanged.
  const baseUnit = project?.gridfinity.baseUnit
  useEffect(() => {
    if (!engine || !project?.layoutSnapshot) return
    if (loadedLoadIdRef.current === loadId) return
    loadedLoadIdRef.current = loadId

    if (!isValidSnapshot(project.layoutSnapshot)) {
      console.warn('Invalid layout snapshot in project file. Skipping restore.')
      return
    }

    // The grid is the project's base unit. A hand-edited or older file can store another size
    // in its layout, and loading that would put it in the undo baseline, for Undo to restore.
    const snapshot = project.layoutSnapshot as unknown as LayoutSnapshot
    isRestoringRef.current = true
    engine.loadSnapshot({
      ...snapshot,
      gridConfig: { ...snapshot.gridConfig, size: baseUnit ?? snapshot.gridConfig.size }
    })
    isRestoringRef.current = false
    // Loading a project is not an undoable edit: the loaded state is the baseline.
    useUndoRedo.getState().reset()
  }, [engine, project?.layoutSnapshot, loadId, baseUnit])

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

  // Sync engine state to project store on every mutation so sessionStorage
  // is always current. Also mark project as modified unless we're restoring
  // from a file load. No debounce — the isRestoringRef guard prevents
  // burst writes during loadSnapshot, and captureSnapshot is cheap
  // (serializes engine state to zustand store).
  useEffect(() => {
    if (!engine) return

    const onMutation = (): void => {
      if (!isRestoringRef.current) {
        useProject.setState({ isModified: true })
      }
      captureSnapshot()
    }

    const unsubs = [
      engine.on('shapeCreated', onMutation),
      engine.on('shapeDeleted', onMutation),
      engine.on('shapeMoved', onMutation),
      engine.on('shapeResized', onMutation),
      engine.on('shapeUpdated', onMutation),
      engine.on('groupChanged', onMutation),
      engine.on('groupMoved', onMutation),
      engine.on('groupResized', onMutation)
    ]

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [engine, captureSnapshot])
}
