/**
 * Project Context - Global state management for project operations
 */

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createEmptyProject } from '../../../shared/types/project'
import type { ProjectData } from '../../../shared/types/project'

interface ProjectContextType {
  project: ProjectData | null
  isModified: boolean
  currentFilePath: string | null
  error: string | null
  createNewProject: (name?: string) => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  clearError: () => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps): React.JSX.Element {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [isModified, setIsModified] = useState(false)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Create a new project
   */
  const createNewProject = useCallback((name?: string): void => {
    const newProject = createEmptyProject(name || 'Untitled Project')
    setProject(newProject)
    setIsModified(true)
    setCurrentFilePath(null)
    setError(null)
    console.log('New project created:', newProject.settings.name)
  }, [])

  /**
   * Open a project from disk
   */
  const openProject = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.project.load()
      if (result.success && result.data) {
        setProject(result.data)
        setIsModified(false)
        setCurrentFilePath(null) // We don't get the path back from dialog
        setError(null)
        console.log('Project loaded:', result.data.settings.name)
      } else if (result.error && !result.error.includes('cancelled')) {
        setError(result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Load error: ${message}`)
    }
  }, [])

  /**
   * Save the current project to disk
   */
  const saveProject = useCallback(async (): Promise<void> => {
    if (!project) {
      setError('No project to save')
      return
    }

    try {
      const result = await window.api.project.save(project, currentFilePath || undefined)
      if (result.success && result.data) {
        setIsModified(false)
        setCurrentFilePath(result.data)
        setError(null)
        console.log('Project saved to:', result.data)
      } else if (result.error && !result.error.includes('cancelled')) {
        setError(result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Save error: ${message}`)
    }
  }, [project, currentFilePath])

  /**
   * Save the current project to a new file (Save As)
   */
  const saveProjectAs = useCallback(async (): Promise<void> => {
    if (!project) {
      setError('No project to save')
      return
    }

    try {
      // Always show dialog by not passing filePath
      const result = await window.api.project.save(project)
      if (result.success && result.data) {
        setIsModified(false)
        setCurrentFilePath(result.data)
        setError(null)
        console.log('Project saved to:', result.data)
      } else if (result.error && !result.error.includes('cancelled')) {
        setError(result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Save error: ${message}`)
    }
  }, [project])

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  const value: ProjectContextType = {
    project,
    isModified,
    currentFilePath,
    error,
    createNewProject,
    openProject,
    saveProject,
    saveProjectAs,
    clearError
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

/**
 * Hook to use project context
 */
export function useProjectContext(): ProjectContextType {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  return context
}
