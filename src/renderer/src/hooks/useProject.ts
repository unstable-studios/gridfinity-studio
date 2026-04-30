/**
 * Zustand store for project state.
 *
 * Entity/bin mutations and hand-rolled undo/redo have been removed.
 * The LayoutEngine is now the source of truth for shapes and groups.
 * Undo/redo is handled by useEngineUndoRedo (snapshot-based).
 *
 * This store manages: project metadata, gridfinity config, file I/O,
 * layout snapshot persistence, export operations, and bake results.
 */

import { create } from 'zustand'
import { createEmptyProject } from '../../../shared/types/project'
import { migrateProject } from '../../../shared/validation/project-validator'
import type {
  ProjectData,
  GlobalSettings,
  GridfinityConfig,
  LayoutSnapshotData
} from '../../../shared/types/project'
import type { MeshDataWithNormals } from '../../../shared/types/worker'
import { downloadBlob } from '../lib/download-blob'

export interface BakeResult {
  mesh: MeshDataWithNormals
  timestamp: number
  warnings: string[]
}

/**
 * Per-bin bake state.
 * - `baking`: a bake is currently in flight; any cached `bakeResults` entry
 *   for this bin is stale and should not be exported.
 * - `ready`: the latest bake completed successfully; `bakeResults` has the
 *   matching mesh.
 * - `error`: the latest bake failed; UI should surface the failure and not
 *   export.
 */
export type BakeStatus = 'baking' | 'ready' | 'error'

// ─── Store shape ────────────────────────────────────────────

interface ProjectState {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
  error: string | null
  recentProjects: string[]
  bakeResults: Map<string, BakeResult>
  /**
   * Bake state per bin. Distinct from `bakeResults`: a bin can be in `baking`
   * while still having a (now-stale) entry in `bakeResults`. Export gating
   * and the Preview sidebar's status pip read from this map.
   */
  bakeStatus: Map<string, BakeStatus>

  // Project metadata mutations
  updateSettings: (patch: Partial<GlobalSettings>) => void
  updateGridfinity: (config: GridfinityConfig) => void

  // File operations
  saveProject: (targetPath?: string) => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  loadProject: (targetPath?: string) => Promise<boolean>
  createNewProject: (config?: { name?: string; baseUnit?: number; tolerance?: number }) => void
  loadRecentProjects: () => Promise<void>

  // Export operations
  exportSTL: (stlData: ArrayBuffer, suggestedFilename?: string) => Promise<boolean>
  export3MF: (data: ArrayBuffer, suggestedFilename?: string) => Promise<boolean>
  exportBatch: (
    files: Array<{ filename: string; data: ArrayBuffer }>
  ) => Promise<{ success: boolean; exported: number }>

  // Layout snapshot (synced from engine)
  setLayoutSnapshot: (snapshot: LayoutSnapshotData) => void

  /**
   * Register a callback that runs before every save operation.
   * Used by useProjectEngineSync to capture the engine snapshot into the project.
   * Returns an unsubscribe function.
   */
  registerBeforeSave: (cb: () => void) => () => void

  // Bake results
  setBakeResult: (binId: string, result: BakeResult | null) => void
  setBakeStatus: (binId: string, status: BakeStatus | null) => void
  clearAllBakeResults: () => void
}

// ─── Session persistence ────────────────────────────────────

const SESSION_KEY = 'gfstudio:session'

interface SessionData {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
}

function loadSession(): SessionData {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt data
  }
  return { project: null, filePath: null, isModified: false }
}

function saveSession(state: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

// ─── Before-save callbacks ───────────────────────────────────

const beforeSaveCallbacks = new Set<() => void>()

// ─── Store ──────────────────────────────────────────────────

const saved = loadSession()

const useProjectStore = create<ProjectState>()((set, get) => {
  return {
    // Initial state
    project: saved.project,
    filePath: saved.filePath,
    isModified: saved.isModified,
    error: null,
    recentProjects: [],
    bakeResults: new Map(),
    bakeStatus: new Map(),

    // ── Settings mutations ──

    updateSettings: (patch) => {
      set((state) => {
        if (!state.project) return state
        return {
          project: { ...state.project, settings: { ...state.project.settings, ...patch } },
          isModified: true
        }
      })
    },

    updateGridfinity: (config) => {
      set((state) => {
        if (!state.project) return state
        return {
          project: { ...state.project, gridfinity: config },
          isModified: true
        }
      })
    },

    // ── File operations ──

    registerBeforeSave: (cb) => {
      beforeSaveCallbacks.add(cb)
      return () => {
        beforeSaveCallbacks.delete(cb)
      }
    },

    saveProject: async (targetPath) => {
      for (const cb of beforeSaveCallbacks) cb()
      const state = get()
      if (!state.project) {
        set({ error: 'No project to save' })
        return false
      }
      try {
        const pathToUse = targetPath ?? state.filePath ?? undefined
        const result = await window.api.project.save(state.project, pathToUse)
        if (result.success) {
          set({
            filePath: result.data ?? state.filePath,
            isModified: false,
            error: null
          })
          return true
        } else {
          set({ error: result.error ?? 'Failed to save project' })
          return false
        }
      } catch (err) {
        set({ error: `Save error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return false
      }
    },

    saveProjectAs: async () => {
      for (const cb of beforeSaveCallbacks) cb()
      const state = get()
      if (!state.project) {
        set({ error: 'No project to save' })
        return false
      }
      try {
        const result = await window.api.project.save(
          state.project,
          undefined,
          state.filePath ?? undefined
        )
        if (result.success) {
          set({
            filePath: result.data ?? state.filePath,
            isModified: false,
            error: null
          })
          return true
        } else {
          set({ error: result.error ?? 'Failed to save project' })
          return false
        }
      } catch (err) {
        set({ error: `Save error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return false
      }
    },

    loadProject: async (targetPath) => {
      try {
        const result = await window.api.project.load(targetPath)
        if (result.success && result.data) {
          const project = migrateProject(result.data.project)
          set({
            project,
            filePath: result.data.filePath,
            isModified: false,
            error: null,
            bakeResults: new Map(),
            bakeStatus: new Map()
          })
          return true
        } else {
          set({ error: result.error ?? 'Failed to load project' })
          return false
        }
      } catch (err) {
        set({ error: `Load error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return false
      }
    },

    createNewProject: (config) => {
      const project = createEmptyProject(config?.name ?? 'Untitled Project')
      if (config?.baseUnit) {
        project.gridfinity.baseUnit = config.baseUnit
        project.gridfinity.gridSpacing = config.baseUnit
      }
      if (config?.tolerance !== undefined) {
        project.gridfinity.tolerance = config.tolerance
      }
      set({
        project,
        filePath: null,
        isModified: true,
        error: null,
        bakeResults: new Map(),
        bakeStatus: new Map()
      })
    },

    loadRecentProjects: async () => {
      try {
        const result = await window.api.project.getRecent()
        if (result.success && result.data) {
          set({ recentProjects: result.data })
        }
      } catch {
        // Silently ignore
      }
    },

    // ── Export operations ──

    exportSTL: async (stlData, suggestedFilename) => {
      // Browser fallback: when the Electron preload bridge isn't present
      // (e.g. running the renderer at localhost:5173 directly), fall back
      // to a blob download so the export still works for testing.
      if (typeof window === 'undefined' || !window.api?.export?.stl) {
        downloadBlob(stlData, suggestedFilename ?? 'gridfinity-bin.stl', 'model/stl')
        set({ error: null })
        return true
      }
      try {
        const result = await window.api.export.stl(stlData)
        if (result.success) {
          set({ error: null })
          return true
        }
        set({ error: result.error ?? 'Failed to export STL' })
        return false
      } catch (err) {
        set({ error: `Export error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return false
      }
    },

    export3MF: async (data, suggestedFilename) => {
      if (typeof window === 'undefined' || !window.api?.export?.threemf) {
        downloadBlob(data, suggestedFilename ?? 'gridfinity-bin.3mf', 'model/3mf')
        set({ error: null })
        return true
      }
      try {
        const result = await window.api.export.threemf(data)
        if (result.success) {
          set({ error: null })
          return true
        }
        set({ error: result.error ?? 'Failed to export 3MF' })
        return false
      } catch (err) {
        set({ error: `Export error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return false
      }
    },

    exportBatch: async (files) => {
      try {
        const result = await window.api.export.batch(files)
        if (result.success) {
          set({ error: null })
          return { success: true, exported: result.exported }
        }
        set({ error: result.error ?? 'Batch export failed' })
        return { success: false, exported: result.exported }
      } catch (err) {
        set({ error: `Export error: ${err instanceof Error ? err.message : 'Unknown error'}` })
        return { success: false, exported: 0 }
      }
    },

    // ── Layout snapshot ──

    setLayoutSnapshot: (snapshot) => {
      const state = get()
      if (!state.project) return
      set({
        project: { ...state.project, layoutSnapshot: snapshot }
      })
    },

    // ── Bake results ──

    setBakeResult: (binId, result) => {
      set((state) => {
        const next = new Map(state.bakeResults)
        if (result) {
          next.set(binId, result)
        } else {
          next.delete(binId)
        }
        return { bakeResults: next }
      })
    },

    setBakeStatus: (binId, status) => {
      set((state) => {
        const next = new Map(state.bakeStatus)
        if (status) {
          next.set(binId, status)
        } else {
          next.delete(binId)
        }
        return { bakeStatus: next }
      })
    },

    clearAllBakeResults: () => {
      set({ bakeResults: new Map(), bakeStatus: new Map() })
    }
  }
})

// ─── Session persistence subscriber ────────────────────────

useProjectStore.subscribe((state) => {
  try {
    saveSession({
      project: state.project,
      filePath: state.filePath,
      isModified: state.isModified
    })
  } catch {
    // swallow — don't break store subscribers
  }
})

// ─── Public API ─────────────────────────────────────────────

export const useProject = useProjectStore
