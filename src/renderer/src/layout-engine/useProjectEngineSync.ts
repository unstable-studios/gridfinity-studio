import { useEffect, useCallback, useRef } from 'react'
import { useLayoutEngine } from './useLayoutEngine'
import { useProject } from '@/hooks/useProject'
import type { LayoutSnapshotData } from '../../../shared/types/project'
import type { LayoutSnapshot } from './types'

/**
 * Syncs the layout engine snapshot with the project store.
 *
 * - Before save: captures engine.toSnapshot() → project.layoutSnapshot
 * - After load: reads project.layoutSnapshot → engine.loadSnapshot()
 *
 * The LayoutSnapshotData (shared/) and LayoutSnapshot (renderer/) types are
 * structurally equivalent but use slightly different shape representations
 * (flat vs discriminated union). The casts here are safe because both encode
 * the same data — just with different TypeScript narrowing strategies.
 */
export function useProjectEngineSync(): {
  saveWithSnapshot: (targetPath?: string) => Promise<boolean>
  saveAsWithSnapshot: () => Promise<boolean>
} {
  const engine = useLayoutEngine()
  const { saveProject, saveProjectAs, setLayoutSnapshot } = useProject()
  const project = useProject((s) => s.project)
  const loadedProjectRef = useRef<string | null>(null)

  // On project load: restore engine state from layoutSnapshot.
  // Only runs when a NEW project is loaded (different createdAt), not on engine switches.
  // Engine switches preserve state via LayoutEngineContext's pendingStateRef.
  const projectId = project?.settings?.createdAt ?? null
  useEffect(() => {
    if (!engine || !project?.layoutSnapshot) return
    if (loadedProjectRef.current === projectId) return
    loadedProjectRef.current = projectId

    // LayoutSnapshotData → LayoutSnapshot: structurally equivalent
    engine.loadSnapshot(project.layoutSnapshot as unknown as LayoutSnapshot)
  }, [engine, project?.layoutSnapshot, projectId])

  const captureSnapshot = useCallback((): void => {
    if (!engine) return
    const snapshot = engine.toSnapshot()
    // LayoutSnapshot → LayoutSnapshotData: structurally equivalent
    setLayoutSnapshot(snapshot as unknown as LayoutSnapshotData)
  }, [engine, setLayoutSnapshot])

  const saveWithSnapshot = useCallback(
    async (targetPath?: string): Promise<boolean> => {
      captureSnapshot()
      return saveProject(targetPath)
    },
    [captureSnapshot, saveProject]
  )

  const saveAsWithSnapshot = useCallback(async (): Promise<boolean> => {
    captureSnapshot()
    return saveProjectAs()
  }, [captureSnapshot, saveProjectAs])

  return { saveWithSnapshot, saveAsWithSnapshot }
}
