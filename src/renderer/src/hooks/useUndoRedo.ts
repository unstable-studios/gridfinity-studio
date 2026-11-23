import { create } from 'zustand'

interface UndoRedoStore {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Drop all history and make the engine's current state the baseline. */
  reset: () => void
}

const noop = (): void => {}

export const useUndoRedo = create<UndoRedoStore>()(() => ({
  canUndo: false,
  canRedo: false,
  undo: noop,
  redo: noop,
  reset: noop
}))
