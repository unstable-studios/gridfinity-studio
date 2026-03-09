/**
 * Pure undo/redo stack with labeled entries.
 *
 * Decoupled from React — the hook wraps this and wires it to engine events.
 * Each entry stores a serialized snapshot and a human-readable label
 * describing the mutation that produced it.
 */

export interface UndoEntry {
  json: string
  label: string
}

export interface UndoRedoDebugState {
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  /** Index of the current state within the undo stack (top of stack). */
  cursor: number
}

export class UndoRedoStack {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  /** Initialize with a baseline snapshot. Clears all history. */
  init(json: string): void {
    this.undoStack = [{ json, label: 'initial' }]
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

  get debugState(): UndoRedoDebugState {
    return {
      undoStack: [...this.undoStack],
      redoStack: [...this.redoStack],
      cursor: this.undoStack.length - 1
    }
  }
}
