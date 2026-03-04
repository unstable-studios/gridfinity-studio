/**
 * React hook for project state management and file operations
 */

import { useState, useCallback } from 'react'
import { createEmptyProject } from '../../../shared/types/project'
import type { ProjectData } from '../../../shared/types/project'
import type { MeshDataWithNormals } from '../../../shared/types/worker'

export interface BakeResult {
  mesh: MeshDataWithNormals
  timestamp: number
  dirty: boolean
  warnings: string[]
}

interface UseProjectResult {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
  recentProjects: string[]
  bakeResult: BakeResult | null
  setBakeResult: (result: BakeResult | null) => void
  markBakeDirty: () => void
  saveProject: (targetPath?: string) => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  loadProject: (targetPath?: string) => Promise<boolean>
  createNewProject: (name?: string) => void
  loadRecentProjects: () => Promise<void>
  exportSTL: (stlData: ArrayBuffer) => Promise<boolean>
  error: string | null
}

/**
 * Hook for managing project state and operations
 *
 * Example usage:
 * ```tsx
 * function MyComponent() {
 *   const { project, saveProject, loadProject, createNewProject } = useProject()
 *
 *   return (
 *     <div>
 *       <button onClick={() => createNewProject()}>New Project</button>
 *       <button onClick={() => loadProject()}>Open Project</button>
 *       <button onClick={() => saveProject()}>Save Project</button>
 *       {project && <h1>{project.settings.name}</h1>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useProject(): UseProjectResult {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [isModified, setIsModified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [bakeResult, setBakeResult] = useState<BakeResult | null>(null)

  const markBakeDirty = useCallback(() => {
    setBakeResult((prev) => (prev ? { ...prev, dirty: true } : null))
  }, [])

  const exportSTL = useCallback(async (stlData: ArrayBuffer): Promise<boolean> => {
    try {
      const result = await window.api.export.stl(stlData)
      if (result.success) {
        setError(null)
        return true
      } else {
        setError(result.error ?? 'Failed to export STL')
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Export error: ${message}`)
      return false
    }
  }, [])

  /**
   * Save the current project to disk
   * If a filePath is already known and no explicit targetPath is given, reuses it
   */
  const saveProject = useCallback(
    async (targetPath?: string): Promise<boolean> => {
      if (!project) {
        setError('No project to save')
        return false
      }

      try {
        const pathToUse = targetPath ?? filePath ?? undefined
        const result = await window.api.project.save(project, pathToUse)
        if (result.success) {
          if (result.data) {
            setFilePath(result.data)
          }
          setIsModified(false)
          setError(null)
          return true
        } else {
          setError(result.error ?? 'Failed to save project')
          return false
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(`Save error: ${message}`)
        return false
      }
    },
    [project, filePath]
  )

  /**
   * Save the current project with a new file path (always shows dialog)
   */
  const saveProjectAs = useCallback(async (): Promise<boolean> => {
    if (!project) {
      setError('No project to save')
      return false
    }

    try {
      // Pass undefined to force the save dialog to appear
      const result = await window.api.project.save(project, undefined)
      if (result.success) {
        if (result.data) {
          setFilePath(result.data)
        }
        setIsModified(false)
        setError(null)
        return true
      } else {
        setError(result.error ?? 'Failed to save project')
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Save error: ${message}`)
      return false
    }
  }, [project])

  /**
   * Load a project from disk
   */
  const loadProject = useCallback(async (targetPath?: string): Promise<boolean> => {
    try {
      const result = await window.api.project.load(targetPath)
      if (result.success && result.data) {
        setProject(result.data)
        setIsModified(false)
        setError(null)
        // We don't know the exact path from the load result unless one was provided
        // The main process tracks it in recent projects either way
        setFilePath(targetPath ?? null)
        return true
      } else {
        setError(result.error ?? 'Failed to load project')
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Load error: ${message}`)
      return false
    }
  }, [])

  /**
   * Create a new project
   */
  const createNewProject = useCallback((name?: string): void => {
    const newProject = createEmptyProject(name ?? 'Untitled Project')
    setProject(newProject)
    setFilePath(null)
    setIsModified(true)
    setError(null)
  }, [])

  /**
   * Load the list of recent project file paths from the main process
   */
  const loadRecentProjects = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.project.getRecent()
      if (result.success && result.data) {
        setRecentProjects(result.data)
      }
    } catch {
      // Silently ignore errors fetching recent projects
    }
  }, [])

  return {
    project,
    filePath,
    isModified,
    recentProjects,
    bakeResult,
    setBakeResult,
    markBakeDirty,
    saveProject,
    saveProjectAs,
    loadProject,
    createNewProject,
    loadRecentProjects,
    exportSTL,
    error
  }
}
