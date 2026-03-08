import { createContext, useContext } from 'react'

export interface UndoRedoState {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const noop = (): void => {}

export const UndoRedoCtx = createContext<UndoRedoState>({
  undo: noop,
  redo: noop,
  canUndo: false,
  canRedo: false
})

export function useUndoRedo(): UndoRedoState {
  return useContext(UndoRedoCtx)
}
