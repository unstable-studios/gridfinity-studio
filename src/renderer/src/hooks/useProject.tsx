/**
 * Example React hook demonstrating project schema usage
 * This can be used as a reference for implementing project management in the UI
 */

import { useState, useCallback } from 'react'
import { createEmptyProject } from '../../../shared/types/project'
import type { ProjectData } from '../../../shared/types/project'

interface UseProjectResult {
  project: ProjectData | null
  isModified: boolean
  saveProject: (filePath?: string) => Promise<boolean>
  loadProject: (filePath?: string) => Promise<boolean>
  createNewProject: (name?: string) => void
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
  const [isModified, setIsModified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Save the current project to disk
   */
  const saveProject = useCallback(
    async (filePath?: string): Promise<boolean> => {
      if (!project) {
        setError('No project to save')
        return false
      }

      try {
        const result = await window.api.project.save(project, filePath)
        if (result.success) {
          setIsModified(false)
          setError(null)
          console.log('Project saved to:', result.data)
          return true
        } else {
          setError(result.error || 'Failed to save project')
          return false
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(`Save error: ${message}`)
        return false
      }
    },
    [project]
  )

  /**
   * Load a project from disk
   */
  const loadProject = useCallback(async (filePath?: string): Promise<boolean> => {
    try {
      const result = await window.api.project.load(filePath)
      if (result.success && result.data) {
        setProject(result.data)
        setIsModified(false)
        setError(null)
        console.log('Project loaded:', result.data.settings.name)
        return true
      } else {
        setError(result.error || 'Failed to load project')
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
    const newProject = createEmptyProject(name || 'Untitled Project')
    setProject(newProject)
    setIsModified(true)
    setError(null)
    console.log('New project created:', newProject.settings.name)
  }, [])

  return {
    project,
    isModified,
    saveProject,
    loadProject,
    createNewProject,
    error
  }
}
