/**
 * Zustand store for project state with undo/redo via zundo.
 *
 * All components call useProject() to access project state and mutations.
 * Undo/redo is automatic — every mutation that changes project data is tracked.
 *
 * Drag operations use pause/resume to batch many moves into one undo entry.
 * File operations (save, load, new) bypass undo entirely.
 */

import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
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

// ─── Store shape ────────────────────────────────────────────

interface ProjectState {
  // Tracked by undo (partialize selects these)
  project: ProjectData | null

  // NOT tracked by undo
  filePath: string | null
  isModified: boolean
  error: string | null
  recentProjects: string[]
  bakeResults: Map<string, BakeResult>

  // Mutations (project data — tracked by undo)
  addEntity: (partial: Partial<Entity> & { type: Entity['type'] }, binId?: string) => Entity
  updateEntity: (id: string, patch: Partial<Entity>) => void
  moveEntity: (id: string, dx: number, dy: number) => void
  removeEntity: (id: string) => void
  updateSettings: (patch: Partial<GlobalSettings>) => void
  updateGridfinity: (config: GridfinityConfig) => void
  addBin: (patch?: Partial<Bin>) => Bin
  updateBin: (id: string, patch: Partial<Bin>) => void
  removeBin: (id: string) => void

  // Drag batching — pause/resume undo tracking around drag gestures
  pauseUndo: () => void
  resumeUndo: () => void

  // File operations (not undoable)
  saveProject: (targetPath?: string) => Promise<boolean>
  saveProjectAs: () => Promise<boolean>
  loadProject: (targetPath?: string) => Promise<boolean>
  createNewProject: (name?: string) => void
  loadRecentProjects: () => Promise<void>

  // Export operations (not undoable)
  exportSTL: (stlData: ArrayBuffer) => Promise<boolean>
  export3MF: (data: ArrayBuffer) => Promise<boolean>
  exportBatch: (
    files: Array<{ filename: string; data: ArrayBuffer }>
  ) => Promise<{ success: boolean; exported: number }>

  // Bake results (not undoable)
  setBakeResult: (binId: string, result: BakeResult | null) => void
  clearAllBakeResults: () => void
}

// ─── Session persistence ────────────────────────────────────

const SESSION_KEY = 'gfstudio:session'
const UNDO_KEY = 'gfstudio:undo'

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

type UndoPartial = { project: ProjectData | null }

function loadUndoHistory(): {
  pastStates: UndoPartial[]
  futureStates: UndoPartial[]
} {
  try {
    const raw = sessionStorage.getItem(UNDO_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt data
  }
  return { pastStates: [], futureStates: [] }
}

function saveUndoHistory(pastStates: UndoPartial[], futureStates: UndoPartial[]): void {
  try {
    sessionStorage.setItem(UNDO_KEY, JSON.stringify({ pastStates, futureStates }))
  } catch {
    // sessionStorage full — silently drop undo history
  }
}

// ─── Temporal helpers ───────────────────────────────────────

function temporalPause(): void {
  useProjectStore.temporal.getState().pause()
}

function temporalResume(): void {
  useProjectStore.temporal.getState().resume()
}

function temporalClear(): void {
  useProjectStore.temporal.getState().clear()
}

// ─── Store ──────────────────────────────────────────────────

const saved = loadSession()
const savedUndo = loadUndoHistory()

const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => ({
      // Initial state
      project: saved.project,
      filePath: saved.filePath,
      isModified: saved.isModified,
      error: null,
      recentProjects: [],
      bakeResults: new Map(),

      // ── Entity mutations ──

      addEntity: (partial, binId) => {
        const state = get()
        const project = state.project
        if (!project) throw new Error('No project')

        let resolvedName = partial.name
        if (!resolvedName) {
          const label = partial.type.charAt(0).toUpperCase() + partial.type.slice(1)
          const existingCount = project.entities.filter((e) => e.type === partial.type).length
          resolvedName = `${label} ${existingCount + 1}`
        }

        const pocket =
          partial.pocket ??
          (() => {
            const targetBin = binId ? project.bins.find((b) => b.id === binId) : project.bins[0]
            if (!targetBin) return { depth: 5, clearance: 0.2 }
            const unitHeight = project.gridfinity.unitHeight ?? 7
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

        const targetId = binId ?? project.bins[0]?.id
        const updatedBins = targetId
          ? project.bins.map((b) =>
              b.id === targetId ? { ...b, entityIds: [...b.entityIds, entity.id] } : b
            )
          : project.bins

        set({
          project: { ...project, entities: [...project.entities, entity], bins: updatedBins },
          isModified: true
        })
        return entity
      },

      updateEntity: (id, patch) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: {
              ...state.project,
              entities: state.project.entities.map((e) =>
                e.id === id ? ({ ...e, ...patch } as Entity) : e
              )
            },
            isModified: true
          }
        })
      },

      moveEntity: (id, dx, dy) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: {
              ...state.project,
              entities: state.project.entities.map((e) => {
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
            },
            isModified: true
          }
        })
      },

      removeEntity: (id) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: {
              ...state.project,
              entities: state.project.entities.filter((e) => e.id !== id),
              bins: state.project.bins.map((b) => ({
                ...b,
                entityIds: b.entityIds.filter((eid) => eid !== id)
              }))
            },
            isModified: true
          }
        })
      },

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

      // ── Bin mutations ──

      addBin: (patch) => {
        const state = get()
        const existingCount = state.project?.bins.length ?? 0
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
        set((state) => {
          if (!state.project) return state
          return {
            project: { ...state.project, bins: [...state.project.bins, bin] },
            isModified: true
          }
        })
        return bin
      },

      updateBin: (id, patch) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: {
              ...state.project,
              bins: state.project.bins.map((b) => (b.id === id ? { ...b, ...patch } : b))
            },
            isModified: true
          }
        })
      },

      removeBin: (id) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: { ...state.project, bins: state.project.bins.filter((b) => b.id !== id) },
            isModified: true
          }
        })
        get().setBakeResult(id, null)
      },

      // ── Drag batching ──

      pauseUndo: () => temporalPause(),
      resumeUndo: () => temporalResume(),

      // ── File operations (not undoable) ──

      saveProject: async (targetPath) => {
        const state = get()
        if (!state.project) {
          set({ error: 'No project to save' })
          return false
        }
        try {
          const pathToUse = targetPath ?? state.filePath ?? undefined
          const result = await window.api.project.save(state.project, pathToUse)
          if (result.success) {
            if (result.data) set({ filePath: result.data })
            set({ isModified: false, error: null })
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
        const state = get()
        if (!state.project) {
          set({ error: 'No project to save' })
          return false
        }
        try {
          const result = await window.api.project.save(state.project, undefined)
          if (result.success) {
            if (result.data) set({ filePath: result.data })
            set({ isModified: false, error: null })
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
            temporalPause()
            set({
              project: result.data.project,
              filePath: result.data.filePath,
              isModified: false,
              error: null,
              bakeResults: new Map()
            })
            temporalClear()
            temporalResume()
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

      createNewProject: (name) => {
        temporalPause()
        set({
          project: createEmptyProject(name ?? 'Untitled Project'),
          filePath: null,
          isModified: true,
          error: null,
          bakeResults: new Map()
        })
        temporalClear()
        temporalResume()
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

      exportSTL: async (stlData) => {
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

      export3MF: async (data) => {
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

      clearAllBakeResults: () => {
        set({ bakeResults: new Map() })
      }
    }),
    {
      // Only track project data in undo history — file path, modified flag,
      // bake results, errors, etc. are excluded
      partialize: (state) => ({
        project: state.project
      }),
      limit: 100,
      equality: (pastState, currentState) => pastState.project === currentState.project,
      // Restore undo history from sessionStorage
      pastStates: savedUndo.pastStates,
      futureStates: savedUndo.futureStates
    }
  )
)

// ─── Session persistence subscriber ────────────────────────

useProjectStore.subscribe((state) => {
  saveSession({
    project: state.project,
    filePath: state.filePath,
    isModified: state.isModified
  })
})

// Persist undo history to sessionStorage
useProjectStore.temporal.subscribe((temporal) => {
  saveUndoHistory(temporal.pastStates as UndoPartial[], temporal.futureStates as UndoPartial[])
})

// ─── Public API ─────────────────────────────────────────────

// Re-export the store hook directly. Components call useProject() as before.
export const useProject = useProjectStore

// Undo/redo access for Navbar and keyboard shortcuts
export function useUndo() {
  const store = useProjectStore.temporal
  const { undo, redo, pastStates, futureStates } = useStore(store)
  return {
    undo,
    redo,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0
  }
}
