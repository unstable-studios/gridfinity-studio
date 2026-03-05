/**
 * React context + hook for project state management and file operations.
 *
 * All components that need project state should call useProject() which
 * reads from a single shared ProjectProvider at the top of the tree.
 */

import { useState, useCallback, useContext, createContext } from 'react'
import { createEmptyProject, createDefaultTransform } from '../../../shared/types/project'
import type {
  ProjectData,
  Entity,
  GlobalSettings,
  GridfinityConfig
} from '../../../shared/types/project'
import type { MeshDataWithNormals } from '../../../shared/types/worker'

export interface AuxMesh {
  mesh: MeshDataWithNormals
  role: 'solid' | 'cutter'
  entityId: string
}

export interface BakeResult {
  mesh: MeshDataWithNormals
  auxMeshes: AuxMesh[]
  timestamp: number
  dirty: boolean
  warnings: string[]
}

export interface UseProjectResult {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
  recentProjects: string[]
  bakeResult: BakeResult | null
  setBakeResult: (result: BakeResult | null) => void
  markBakeDirty: () => void
  addEntity: (partial: Partial<Entity> & { type: Entity['type'] }) => Entity
  updateEntity: (id: string, patch: Partial<Entity>) => void
  removeEntity: (id: string) => void
  saveProject: (targetPath?: string) => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  loadProject: (targetPath?: string) => Promise<boolean>
  createNewProject: (name?: string) => void
  loadRecentProjects: () => Promise<void>
  updateSettings: (patch: Partial<GlobalSettings>) => void
  updateGridfinity: (config: GridfinityConfig) => void
  exportSTL: (stlData: ArrayBuffer) => Promise<boolean>
  error: string | null
}

const ProjectCtx = createContext<UseProjectResult | null>(null)

export function ProjectProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const value = useProjectState()
  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject(): UseProjectResult {
  const ctx = useContext(ProjectCtx)
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return ctx
}

// ─── Internal state implementation ──────────────────────────────

function useProjectState(): UseProjectResult {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [isModified, setIsModified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [bakeResult, setBakeResult] = useState<BakeResult | null>(null)

  const markBakeDirty = useCallback(() => {
    setBakeResult((prev) => (prev ? { ...prev, dirty: true } : null))
  }, [])

  const addEntity = useCallback(
    (partial: Partial<Entity> & { type: Entity['type'] }): Entity => {
      let resolvedName = partial.name
      if (!resolvedName) {
        // Count existing entities of the same type for sequential naming
        const label = partial.type.charAt(0).toUpperCase() + partial.type.slice(1)
        const existingCount = project?.entities.filter((e) => e.type === partial.type).length ?? 0
        resolvedName = `${label} ${existingCount + 1}`
      }

      const entity = {
        id: crypto.randomUUID(),
        name: resolvedName,
        transform: partial.transform ?? createDefaultTransform(),
        visible: partial.visible ?? true,
        locked: partial.locked ?? false,
        properties: partial.properties ?? {},
        ...partial
      } as Entity

      setProject((prev) => {
        if (!prev) return prev
        return { ...prev, entities: [...prev.entities, entity] }
      })
      setIsModified(true)
      setBakeResult((prev) => (prev ? { ...prev, dirty: true } : null))
      return entity
    },
    [project?.entities]
  )

  const updateEntity = useCallback((id: string, patch: Partial<Entity>) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        entities: prev.entities.map((e) => (e.id === id ? ({ ...e, ...patch } as Entity) : e))
      }
    })
    setIsModified(true)
    setBakeResult((prev) => (prev ? { ...prev, dirty: true } : null))
  }, [])

  const removeEntity = useCallback((id: string) => {
    setProject((prev) => {
      if (!prev) return prev
      return { ...prev, entities: prev.entities.filter((e) => e.id !== id) }
    })
    setIsModified(true)
    setBakeResult((prev) => (prev ? { ...prev, dirty: true } : null))
  }, [])

  const updateSettings = useCallback((patch: Partial<GlobalSettings>) => {
    setProject((prev) => {
      if (!prev) return prev
      return { ...prev, settings: { ...prev.settings, ...patch } }
    })
    setIsModified(true)
  }, [])

  const updateGridfinity = useCallback((config: GridfinityConfig) => {
    setProject((prev) => {
      if (!prev) return prev
      return { ...prev, gridfinity: config }
    })
    setIsModified(true)
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

  const saveProjectAs = useCallback(async (): Promise<boolean> => {
    if (!project) {
      setError('No project to save')
      return false
    }

    try {
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

  const loadProject = useCallback(async (targetPath?: string): Promise<boolean> => {
    try {
      const result = await window.api.project.load(targetPath)
      if (result.success && result.data) {
        setProject(result.data.project)
        setFilePath(result.data.filePath)
        setIsModified(false)
        setError(null)
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

  const createNewProject = useCallback((name?: string): void => {
    const newProject = createEmptyProject(name ?? 'Untitled Project')
    setProject(newProject)
    setFilePath(null)
    setIsModified(true)
    setError(null)
  }, [])

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
    addEntity,
    updateEntity,
    removeEntity,
    updateSettings,
    updateGridfinity,
    saveProject,
    saveProjectAs,
    loadProject,
    createNewProject,
    loadRecentProjects,
    exportSTL,
    error
  }
}
