/**
 * Pure undo/redo stack with labeled entries.
 *
 * Decoupled from React — the hook wraps this and wires it to engine events.
 * Each entry stores a serialized snapshot and a human-readable label
 * describing the change that produced it, which the history panel shows.
 */

export interface UndoEntry {
  json: string
  label: string
}

/** Every step that can be reached, for the history panel. */
export interface UndoHistory {
  /** What each step did, oldest first. The first is where the history starts. */
  labels: string[]
  /** The step the layout is at now. Steps after it are the ones redo would bring back. */
  current: number
}

/** The label of the state a history starts from. */
export const START_LABEL = 'Start'

export class UndoRedoStack {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  /** Initialize with a baseline snapshot. Clears all history. */
  init(json: string): void {
    this.undoStack = [{ json, label: START_LABEL }]
    this.redoStack = []
  }

  /** Push a new snapshot. Clears the redo stack. Returns false if deduped. */
  push(json: string, label: string): boolean {
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1].json === json) {
      return false
    }
    this.undoStack.push({ json, label })
    if (this.undoStack.length > this.maxSize) this.undoStack.shift()
    this.redoStack = []
    return true
  }

  /** Undo: move top of undo → redo, return the new current snapshot to load. */
  undo(): string | null {
    if (this.undoStack.length < 2) return null
    this.redoStack.push(this.undoStack.pop()!)
    return this.undoStack[this.undoStack.length - 1].json
  }

  /** Redo: move top of redo → undo, return the snapshot to load. */
  redo(): string | null {
    if (this.redoStack.length === 0) return null
    const entry = this.redoStack.pop()!
    this.undoStack.push(entry)
    return entry.json
  }

  get canUndo(): boolean {
    return this.undoStack.length >= 2
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** The snapshot the layout is at now, if there is a history at all. */
  get currentJson(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.json ?? null
  }

  /**
   * Go straight to step `index` of `history.labels`, undoing or redoing as many steps as it
   * takes. Returns the snapshot to load, or null if that is not a step or is the current one.
   */
  goTo(index: number): string | null {
    const last = this.undoStack.length + this.redoStack.length - 1
    const current = this.undoStack.length - 1
    if (!Number.isInteger(index) || index < 0 || index > last || index === current) return null
    while (this.undoStack.length - 1 > index) this.redoStack.push(this.undoStack.pop()!)
    while (this.undoStack.length - 1 < index) this.undoStack.push(this.redoStack.pop()!)
    return this.undoStack[index].json
  }

  get history(): UndoHistory {
    return {
      // The redo stack holds the nearest step last.
      labels: [...this.undoStack, ...[...this.redoStack].reverse()].map((entry) => entry.label),
      current: this.undoStack.length - 1
    }
  }
}
