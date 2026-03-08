import { create } from 'zustand'

interface UndoRedoStore {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

const noop = (): void => {}

export const useUndoRedo = create<UndoRedoStore>()(() => ({
  canUndo: false,
  canRedo: false,
  undo: noop,
  redo: noop
}))
