import { useEffect } from 'react'
import { useLayoutEngine, useEngineState } from '@/layout-engine'
import { useProject } from './useProject'

/**
 * Keeps the main process told whether closing the window would lose work, and saves the
 * project when the person chooses Save on the way out. Mount this once.
 *
 * A project that has never been saved and has nothing on the canvas has nothing to lose, so
 * it closes without a question even though it counts as unsaved.
 */
export function useCloseGuard(): void {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const isModified = useProject((s) => s.isModified)
  const filePath = useProject((s) => s.filePath)
  const saveProject = useProject((s) => s.saveProject)

  // `tick` changes with every edit, so the empty check is made again.
  void tick
  const canvasIsEmpty =
    !engine || (engine.getAllGroups().length === 0 && engine.getAllShapes().length === 0)
  const hasUnsavedWork = isModified && !(filePath === null && canvasIsEmpty)

  useEffect(() => {
    window.api?.closeGuard?.setUnsaved(hasUnsavedWork)
  }, [hasUnsavedWork])

  useEffect(() => window.api?.closeGuard?.onSaveRequested(() => saveProject()), [saveProject])
}
