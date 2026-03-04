/**
 * Undo/Redo command stack for Gridfinity Studio
 *
 * Implements the Command pattern: each undoable action is an UndoCommand
 * with execute() and undo() methods. The UndoStack manages past/future
 * stacks with a configurable max depth.
 */

export interface UndoCommand {
  id: string
  label: string
  execute(): void
  undo(): void
}

const DEFAULT_MAX_DEPTH = 100

export class UndoStack {
  private past: UndoCommand[] = []
  private future: UndoCommand[] = []
  private readonly maxDepth: number

  constructor(maxDepth: number = DEFAULT_MAX_DEPTH) {
    this.maxDepth = maxDepth
  }

  /**
   * Execute a command and push it onto the past stack.
   * Clears the future stack (no redo after a new action).
   * Drops the oldest command if maxDepth is exceeded.
   */
  push(cmd: UndoCommand): void {
    cmd.execute()
    this.past.push(cmd)
    this.future = []

    if (this.past.length > this.maxDepth) {
      this.past.shift()
    }
  }

  /**
   * Undo the most recent command. No-op if nothing to undo.
   */
  undo(): void {
    const cmd = this.past.pop()
    if (!cmd) return
    cmd.undo()
    this.future.push(cmd)
  }

  /**
   * Redo the most recently undone command. No-op if nothing to redo.
   */
  redo(): void {
    const cmd = this.future.pop()
    if (!cmd) return
    cmd.execute()
    this.past.push(cmd)
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  /**
   * Label of the most recent past command, or null if the stack is empty.
   */
  get lastLabel(): string | null {
    return this.past.length > 0 ? this.past[this.past.length - 1].label : null
  }

  /**
   * Clear both past and future stacks.
   */
  clear(): void {
    this.past = []
    this.future = []
  }
}
