import { create } from 'zustand'
import type { UndoHistory } from '@/layout-engine/undo-redo-stack'

interface UndoRedoStore {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Drop all history and make the engine's current state the baseline. */
  reset: () => void
  /** Every step that can be reached, and which one the layout is at. */
  history: UndoHistory
  /** Go straight to a step of `history`, undoing or redoing as many as it takes. */
  goTo: (index: number) => void
  /** Whether the history panel is showing. */
  historyOpen: boolean
}

const noop = (): void => {}

export const useUndoRedo = create<UndoRedoStore>()(() => ({
  canUndo: false,
  canRedo: false,
  undo: noop,
  redo: noop,
  reset: noop,
  history: { labels: [], current: -1 },
  goTo: noop,
  historyOpen: false
}))
