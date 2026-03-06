/**
 * React context + hook for project state management and file operations.
 *
 * All components that need project state should call useProject() which
 * reads from a single shared ProjectProvider at the top of the tree.
 */

import { useState, useCallback, useEffect, useContext, createContext } from 'react'
import {
  createEmptyProject,
  createDefaultTransform,
  computeDefaultPocketDepth
} from '../../../shared/types/project'
import type {
  ProjectData,
  Entity,
  Bin,
  GlobalSettings,
  GridfinityConfig
} from '../../../shared/types/project'
import type { MeshDataWithNormals } from '../../../shared/types/worker'

export interface BakeResult {
  mesh: MeshDataWithNormals
  timestamp: number
  warnings: string[]
}

export interface UseProjectResult {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
  recentProjects: string[]
  bakeResults: Map<string, BakeResult>
  setBakeResult: (binId: string, result: BakeResult | null) => void
  clearAllBakeResults: () => void
  addEntity: (partial: Partial<Entity> & { type: Entity['type'] }, binId?: string) => Entity
  updateEntity: (id: string, patch: Partial<Entity>) => void
  moveEntity: (id: string, dx: number, dy: number) => void
  removeEntity: (id: string) => void
  saveProject: (targetPath?: string) => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  loadProject: (targetPath?: string) => Promise<boolean>
  createNewProject: (name?: string) => void
  loadRecentProjects: () => Promise<void>
  updateSettings: (patch: Partial<GlobalSettings>) => void
  updateGridfinity: (config: GridfinityConfig) => void
  addBin: (patch?: Partial<Bin>) => Bin
  updateBin: (id: string, patch: Partial<Bin>) => void
  removeBin: (id: string) => void
  exportSTL: (stlData: ArrayBuffer) => Promise<boolean>
  export3MF: (data: ArrayBuffer) => Promise<boolean>
  exportBatch: (
    files: Array<{ filename: string; data: ArrayBuffer }>
  ) => Promise<{ success: boolean; exported: number }>
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

const SESSION_KEY = 'gfstudio:session'

function loadSession(): {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
} {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt data
  }
  return { project: null, filePath: null, isModified: false }
}

function useProjectState(): UseProjectResult {
  const saved = loadSession()
  const [project, setProject] = useState<ProjectData | null>(saved.project)
  const [filePath, setFilePath] = useState<string | null>(saved.filePath)
  const [isModified, setIsModified] = useState(saved.isModified)
  const [error, setError] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [bakeResults, setBakeResults] = useState<Map<string, BakeResult>>(new Map())

  const setBakeResult = useCallback((binId: string, result: BakeResult | null) => {
    setBakeResults((prev) => {
      const next = new Map(prev)
      if (result) {
        next.set(binId, result)
      } else {
        next.delete(binId)
      }
      return next
    })
  }, [])

  const clearAllBakeResults = useCallback(() => {
    setBakeResults(new Map())
  }, [])

  // Persist to sessionStorage so refresh doesn't lose state
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ project, filePath, isModified }))
  }, [project, filePath, isModified])

  const addEntity = useCallback(
    (partial: Partial<Entity> & { type: Entity['type'] }, binId?: string): Entity => {
      let resolvedName = partial.name
      if (!resolvedName) {
        // Count existing entities of the same type for sequential naming
        const label = partial.type.charAt(0).toUpperCase() + partial.type.slice(1)
        const existingCount = project?.entities.filter((e) => e.type === partial.type).length ?? 0
        resolvedName = `${label} ${existingCount + 1}`
      }

      // Auto-assign pocket config if not explicitly provided
      const pocket =
        partial.pocket ??
        (() => {
          const bins = project?.bins ?? []
          const targetBin = binId ? bins.find((b) => b.id === binId) : bins[0]
          if (!targetBin) return { depth: 5, clearance: 0.2 }
          const unitHeight = project?.gridfinity.unitHeight ?? 7
          return {
            depth: computeDefaultPocketDepth(targetBin.height, unitHeight),
            clearance: 0.2
          }
        })()

      const entity = {
        id: crypto.randomUUID(),
        name: resolvedName,
        transform: partial.transform ?? createDefaultTransform(),
        visible: partial.visible ?? true,
        locked: partial.locked ?? false,
        properties: partial.properties ?? {},
        ...partial,
        pocket
      } as Entity

      setProject((prev) => {
        if (!prev) return prev
        // Add entity and associate with target bin
        const targetId = binId ?? prev.bins[0]?.id
        const updatedBins = targetId
          ? prev.bins.map((b) =>
              b.id === targetId ? { ...b, entityIds: [...b.entityIds, entity.id] } : b
            )
          : prev.bins
        return { ...prev, entities: [...prev.entities, entity], bins: updatedBins }
      })
      setIsModified(true)

      return entity
    },
    [project?.entities, project?.bins, project?.gridfinity]
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
  }, [])

  const moveEntity = useCallback((id: string, dx: number, dy: number) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        entities: prev.entities.map((e) => {
          if (e.id !== id) return e
          return {
            ...e,
            transform: {
              ...e.transform,
              position: {
                x: e.transform.position.x + dx,
                y: e.transform.position.y + dy,
                z: e.transform.position.z
              }
            }
          } as Entity
        })
      }
    })
    setIsModified(true)
  }, [])

  const removeEntity = useCallback((id: string) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        entities: prev.entities.filter((e) => e.id !== id),
        bins: prev.bins.map((b) => ({
          ...b,
          entityIds: b.entityIds.filter((eid) => eid !== id)
        }))
      }
    })
    setIsModified(true)
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
  }, [])

  const addBin = useCallback(
    (patch?: Partial<Bin>): Bin => {
      const existingCount = project?.bins.length ?? 0
      const bin: Bin = {
        id: crypto.randomUUID(),
        name: `Bin ${existingCount + 1}`,
        width: 1,
        depth: 1,
        height: 3,
        position: { x: 0, y: 0 },
        hasDividers: false,
        hasLabel: false,
        hasStackingLip: true,
        entityIds: [],
        properties: {},
        ...patch
      }
      setProject((prev) => {
        if (!prev) return prev
        return { ...prev, bins: [...prev.bins, bin] }
      })
      setIsModified(true)

      return bin
    },
    [project?.bins.length]
  )

  const updateBin = useCallback((id: string, patch: Partial<Bin>) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        bins: prev.bins.map((b) => (b.id === id ? { ...b, ...patch } : b))
      }
    })
    setIsModified(true)
  }, [])

  const removeBin = useCallback(
    (id: string) => {
      setProject((prev) => {
        if (!prev) return prev
        return { ...prev, bins: prev.bins.filter((b) => b.id !== id) }
      })
      setBakeResult(id, null)
      setIsModified(true)
    },
    [setBakeResult]
  )

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

  const export3MF = useCallback(async (data: ArrayBuffer): Promise<boolean> => {
    try {
      const result = await window.api.export.threemf(data)
      if (result.success) {
        setError(null)
        return true
      } else {
        setError(result.error ?? 'Failed to export 3MF')
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Export error: ${message}`)
      return false
    }
  }, [])

  const exportBatch = useCallback(
    async (
      files: Array<{ filename: string; data: ArrayBuffer }>
    ): Promise<{ success: boolean; exported: number }> => {
      try {
        const result = await window.api.export.batch(files)
        if (result.success) {
          setError(null)
          return { success: true, exported: result.exported }
        } else {
          setError(result.error ?? 'Batch export failed')
          return { success: false, exported: result.exported }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(`Export error: ${message}`)
        return { success: false, exported: 0 }
      }
    },
    []
  )

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

  const loadProject = useCallback(
    async (targetPath?: string): Promise<boolean> => {
      try {
        const result = await window.api.project.load(targetPath)
        if (result.success && result.data) {
          setProject(result.data.project)
          setFilePath(result.data.filePath)
          setIsModified(false)
          setError(null)
          clearAllBakeResults()
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
    },
    [clearAllBakeResults]
  )

  const createNewProject = useCallback(
    (name?: string): void => {
      const newProject = createEmptyProject(name ?? 'Untitled Project')
      setProject(newProject)
      setFilePath(null)
      setIsModified(true)
      setError(null)
      clearAllBakeResults()
    },
    [clearAllBakeResults]
  )

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
    bakeResults,
    setBakeResult,
    clearAllBakeResults,
    addEntity,
    updateEntity,
    moveEntity,
    removeEntity,
    updateSettings,
    updateGridfinity,
    addBin,
    updateBin,
    removeBin,
    saveProject,
    saveProjectAs,
    loadProject,
    createNewProject,
    loadRecentProjects,
    exportSTL,
    export3MF,
    exportBatch,
    error
  }
}
