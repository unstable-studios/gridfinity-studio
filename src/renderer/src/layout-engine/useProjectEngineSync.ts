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
 */
export function useProjectEngineSync(): {
  saveWithSnapshot: (targetPath?: string) => Promise<boolean>
  saveAsWithSnapshot: () => Promise<boolean>
} {
  const engine = useLayoutEngine()
  const { saveProject, saveProjectAs, setLayoutSnapshot } = useProject()
  const project = useProject((s) => s.project)
  const loadedRef = useRef(false)

  // On project load: restore engine state from layoutSnapshot
  useEffect(() => {
    if (!engine || !project?.layoutSnapshot || loadedRef.current) return
    loadedRef.current = true

    const snapshot = project.layoutSnapshot as unknown as LayoutSnapshot
    engine.loadSnapshot(snapshot)
  }, [engine, project?.layoutSnapshot])

  // Reset loaded flag when project or engine changes (new project, different file, or engine switch)
  const projectId = project?.settings?.createdAt
  useEffect(() => {
    loadedRef.current = false
  }, [projectId, engine])

  const captureSnapshot = useCallback((): void => {
    if (!engine) return
    const snapshot = engine.toSnapshot()
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
