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
import { CURRENT_SCHEMA_VERSION, createEmptyProject } from '../../../shared/types/project'
import { repairProject } from '../../../shared/validation/project-validator'
import { loadNewProjectDefaults } from '@/lib/new-project-defaults'
import type {
  ProjectData,
  GlobalSettings,
  GridfinityConfig,
  LayoutSnapshotData
} from '../../../shared/types/project'
import type { BakedMesh } from '../../../shared/types/worker'
import type { BatchExportFile, ExportFormat } from '../../../shared/types/export'
import { downloadBlob } from '../lib/download-blob'
import type { ExampleProject } from '../lib/example-projects'
import { fileName } from '../lib/file-errors'
import {
  notifyExported,
  notifyExportFailed,
  notifyOpenFailed,
  notifySaveFailed
} from '../lib/project-notices'

export interface BakeResult {
  mesh: BakedMesh
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
  /**
   * Counts every project put in place (new, opened or example). Each load has its own value,
   * so the layout engine reloads when the same file is opened again, which `settings.createdAt`
   * cannot tell apart. Not saved with the session: a reload starts over at 0.
   */
  loadId: number
  isModified: boolean
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
  /** Open a bundled example as a new project with no file. */
  openExample: (example: ExampleProject) => void
  loadRecentProjects: () => Promise<void>

  // Export operations
  exportSTL: (stlData: ArrayBuffer, suggestedFilename?: string) => Promise<boolean>
  export3MF: (data: ArrayBuffer, suggestedFilename?: string) => Promise<boolean>
  /** Write one file per entry to a folder the person chooses. */
  exportBatch: (files: BatchExportFile[], format: ExportFormat) => Promise<boolean>

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
    if (raw) {
      const session = JSON.parse(raw) as SessionData
      // A project kept across a reload skips the checks a file goes through. One left by
      // another format of the app is dropped, not opened as if it were this one.
      const version = session.project?.schemaVersion
      if (session.project === null || version === CURRENT_SCHEMA_VERSION) return session
    }
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
    loadId: 0,
    isModified: saved.isModified,
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
        return false
      }
      try {
        const pathToUse = targetPath ?? state.filePath ?? undefined
        const result = await window.api.project.save(state.project, pathToUse)
        if (result.success) {
          set({
            filePath: result.data ?? state.filePath,
            isModified: false
          })
          return true
        } else {
          if (result.reason !== 'cancelled') notifySaveFailed(result.reason, result.error)
          return false
        }
      } catch (err) {
        notifySaveFailed(undefined, err instanceof Error ? err.message : undefined)
        return false
      }
    },

    saveProjectAs: async () => {
      for (const cb of beforeSaveCallbacks) cb()
      const state = get()
      if (!state.project) {
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
            isModified: false
          })
          return true
        } else {
          if (result.reason !== 'cancelled') notifySaveFailed(result.reason, result.error)
          return false
        }
      } catch (err) {
        notifySaveFailed(undefined, err instanceof Error ? err.message : undefined)
        return false
      }
    },

    loadProject: async (targetPath) => {
      try {
        const result = await window.api.project.load(targetPath)
        if (result.success && result.data) {
          const project = repairProject(result.data.project)
          set({
            project,
            filePath: result.data.filePath,
            loadId: get().loadId + 1,
            isModified: false,
            bakeResults: new Map(),
            bakeStatus: new Map()
          })
          return true
        } else {
          if (result.reason !== 'cancelled') notifyOpenFailed(result.reason, result.error)
          return false
        }
      } catch (err) {
        notifyOpenFailed(undefined, err instanceof Error ? err.message : undefined)
        return false
      }
    },

    createNewProject: (config) => {
      // A new project starts with the person's saved defaults, or the app's.
      const project = createEmptyProject(
        config?.name ?? 'Untitled project',
        loadNewProjectDefaults()
      )
      if (config?.baseUnit) {
        project.gridfinity.baseUnit = config.baseUnit
        project.gridfinity.gridSpacing = config.baseUnit
        project.layoutSnapshot.gridConfig.size = config.baseUnit
      }
      if (config?.tolerance !== undefined) {
        project.gridfinity.tolerance = config.tolerance
      }
      set({
        project,
        filePath: null,
        loadId: get().loadId + 1,
        isModified: true,
        bakeResults: new Map(),
        bakeStatus: new Map()
      })
    },

    openExample: (example) => {
      set({
        project: repairProject(example.build()),
        filePath: null,
        loadId: get().loadId + 1,
        // Nothing of the person's is in it yet, so closing it does not ask to save.
        isModified: false,
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
        return true
      }
      try {
        const result = await window.api.export.stl(stlData, suggestedFilename)
        if (result.success) {
          if (result.data) notifyExported(fileName(result.data))
          return true
        }
        if (result.reason !== 'cancelled') notifyExportFailed(result.error)
        return false
      } catch (err) {
        notifyExportFailed(err instanceof Error ? err.message : undefined)
        return false
      }
    },

    export3MF: async (data, suggestedFilename) => {
      if (typeof window === 'undefined' || !window.api?.export?.threemf) {
        downloadBlob(data, suggestedFilename ?? 'gridfinity-bin.3mf', 'model/3mf')
        return true
      }
      try {
        const result = await window.api.export.threemf(data, suggestedFilename)
        if (result.success) {
          if (result.data) notifyExported(fileName(result.data))
          return true
        }
        if (result.reason !== 'cancelled') notifyExportFailed(result.error)
        return false
      } catch (err) {
        notifyExportFailed(err instanceof Error ? err.message : undefined)
        return false
      }
    },

    exportBatch: async (files, format) => {
      try {
        const result = await window.api.export.batch(files, format)
        if (result.success) {
          if (result.data) {
            const { directory } = result.data
            const count = result.data.files.length
            notifyExported(
              // A drive or the root folder has no last part to its path.
              `${count} file${count === 1 ? '' : 's'} to ${fileName(directory) || directory}`
            )
          }
          return true
        }
        if (result.reason !== 'cancelled') {
          const written = result.data?.files.length ?? 0
          notifyExportFailed(
            result.error,
            written > 0 ? `${written} of ${files.length}` : undefined
          )
        }
        return false
      } catch (err) {
        notifyExportFailed(err instanceof Error ? err.message : undefined)
        return false
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
