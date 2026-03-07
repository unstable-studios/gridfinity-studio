/**
 * Zustand store for project state with hand-rolled undo/redo.
 *
 * All components call useProject() to access project state and mutations.
 * Undoable mutations snapshot via pushUndo() before applying updates with set().
 * Drag operations call startDrag/endDrag to batch moves into one undo entry.
 * File operations call set() directly — naturally excluded from undo.
 */

import { create } from 'zustand'
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

const UNDO_LIMIT = 100

interface ProjectState {
  project: ProjectData | null
  filePath: string | null
  isModified: boolean
  error: string | null
  recentProjects: string[]
  bakeResults: Map<string, BakeResult>

  // Undo internals
  _undoStack: ProjectData[]
  _redoStack: ProjectData[]
  _dragging: boolean

  // Mutations (undoable)
  addEntity: (partial: Partial<Entity> & { type: Entity['type'] }, binId?: string) => Entity
  updateEntity: (id: string, patch: Partial<Entity>) => void
  moveEntity: (id: string, dx: number, dy: number) => void
  removeEntity: (id: string) => void
  updateSettings: (patch: Partial<GlobalSettings>) => void
  updateGridfinity: (config: GridfinityConfig) => void
  addBin: (patch?: Partial<Bin>) => Bin
  updateBin: (id: string, patch: Partial<Bin>) => void
  moveBin: (id: string, dx: number, dy: number) => void
  removeBin: (id: string) => void

  // Drag batching
  startDrag: () => void
  endDrag: () => void

  // Undo/redo
  undo: () => void
  redo: () => void

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

function loadUndoHistory(): { undoStack: ProjectData[]; redoStack: ProjectData[] } {
  try {
    const raw = sessionStorage.getItem(UNDO_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt data
  }
  return { undoStack: [], redoStack: [] }
}

function saveUndoHistory(undoStack: ProjectData[], redoStack: ProjectData[]): void {
  try {
    sessionStorage.setItem(UNDO_KEY, JSON.stringify({ undoStack, redoStack }))
  } catch {
    // sessionStorage full — silently drop
  }
}

// ─── Store ──────────────────────────────────────────────────

const saved = loadSession()
const savedUndo = loadUndoHistory()

const useProjectStore = create<ProjectState>()((set, get) => {
  // Push current project onto undo stack (if not dragging)
  function pushUndo(): void {
    const { project, _undoStack, _dragging } = get()
    if (_dragging || !project) return
    const stack = [..._undoStack, project]
    if (stack.length > UNDO_LIMIT) stack.shift()
    set({ _undoStack: stack, _redoStack: [] })
  }

  return {
    // Initial state
    project: saved.project,
    filePath: saved.filePath,
    isModified: saved.isModified,
    error: null,
    recentProjects: [],
    bakeResults: new Map(),
    _undoStack: savedUndo.undoStack,
    _redoStack: savedUndo.redoStack,
    _dragging: false,

    // ── Entity mutations ──

    addEntity: (partial, binId) => {
      pushUndo()
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
      pushUndo()
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
      pushUndo()
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
      pushUndo()
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
      pushUndo()
      set((state) => {
        if (!state.project) return state
        return {
          project: { ...state.project, settings: { ...state.project.settings, ...patch } },
          isModified: true
        }
      })
    },

    updateGridfinity: (config) => {
      pushUndo()
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
      pushUndo()
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
      pushUndo()
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

    moveBin: (id, dx, dy) => {
      pushUndo()
      set((state) => {
        if (!state.project) return state
        return {
          project: {
            ...state.project,
            bins: state.project.bins.map((b) =>
              b.id === id ? { ...b, position: { x: b.position.x + dx, y: b.position.y + dy } } : b
            ),
            entities: state.project.entities.map((e) => {
              const bin = state.project!.bins.find((b) => b.id === id)
              if (!bin?.entityIds.includes(e.id)) return e
              return {
                ...e,
                transform: {
                  ...e.transform,
                  position: {
                    ...e.transform.position,
                    x: e.transform.position.x + dx,
                    y: e.transform.position.y + dy
                  }
                }
              }
            })
          },
          isModified: true
        }
      })
    },

    removeBin: (id) => {
      pushUndo()
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

    startDrag: () => {
      // Snapshot before drag so undo returns here
      const { project, _undoStack } = get()
      if (!project) return
      const stack = [..._undoStack, project]
      if (stack.length > UNDO_LIMIT) stack.shift()
      set({ _undoStack: stack, _redoStack: [], _dragging: true })
    },

    endDrag: () => {
      const { project, _undoStack } = get()
      let stack = _undoStack
      // Drop no-op snapshot if nothing changed during the drag
      if (stack.length > 0 && stack[stack.length - 1] === project) {
        stack = stack.slice(0, -1)
      }
      set({ _undoStack: stack, _dragging: false })
    },

    // ── Undo/redo ──

    undo: () => {
      const { project, _undoStack } = get()
      if (_undoStack.length === 0 || !project) return
      const stack = [..._undoStack]
      const prev = stack.pop()!
      set({
        project: prev,
        _undoStack: stack,
        _redoStack: [...get()._redoStack, project],
        isModified: true
      })
    },

    redo: () => {
      const { project, _redoStack } = get()
      if (_redoStack.length === 0 || !project) return
      const stack = [..._redoStack]
      const next = stack.pop()!
      set({
        project: next,
        _redoStack: stack,
        _undoStack: [...get()._undoStack, project],
        isModified: true
      })
    },

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
          set({
            project: result.data.project,
            filePath: result.data.filePath,
            isModified: false,
            error: null,
            bakeResults: new Map(),
            _undoStack: [],
            _redoStack: []
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

    createNewProject: (name) => {
      set({
        project: createEmptyProject(name ?? 'Untitled Project'),
        filePath: null,
        isModified: true,
        error: null,
        bakeResults: new Map(),
        _undoStack: [],
        _redoStack: []
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
  }
})

// ─── Session persistence subscriber ────────────────────────

let _lastUndoStack = useProjectStore.getState()._undoStack
let _lastRedoStack = useProjectStore.getState()._redoStack

useProjectStore.subscribe((state) => {
  try {
    saveSession({
      project: state.project,
      filePath: state.filePath,
      isModified: state.isModified
    })

    const undoChanged = state._undoStack !== _lastUndoStack
    const redoChanged = state._redoStack !== _lastRedoStack
    if (undoChanged || redoChanged) {
      saveUndoHistory(state._undoStack, state._redoStack)
      _lastUndoStack = state._undoStack
      _lastRedoStack = state._redoStack
    }
  } catch {
    // sessionStorage quota exceeded — drop undo history to free space
    try {
      saveUndoHistory([], [])
      saveSession({
        project: state.project,
        filePath: state.filePath,
        isModified: state.isModified
      })
    } catch {
      // swallow — don't break store subscribers
    }
  }
})

// ─── Public API ─────────────────────────────────────────────

export const useProject = useProjectStore

export function useUndo() {
  const canUndo = useProjectStore((s) => s._undoStack.length > 0)
  const canRedo = useProjectStore((s) => s._redoStack.length > 0)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  return { undo, redo, canUndo, canRedo }
}
