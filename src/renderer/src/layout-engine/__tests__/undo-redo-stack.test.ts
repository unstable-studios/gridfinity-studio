import { describe, it, expect } from 'vitest'
import { UndoRedoStack } from '../undo-redo-stack'

describe('UndoRedoStack', () => {
  // ─── Basic operations ──────────────────────────────────────────────────────

  it('starts empty with no undo/redo', () => {
    const stack = new UndoRedoStack()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
  })

  it('init sets baseline, cannot undo single entry', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
  })

  it('push enables undo, clears redo', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(false)
  })

  it('push deduplicates identical snapshots', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    expect(stack.push('A', 'shapeMoved')).toBe(false)
    expect(stack.canUndo).toBe(false)
  })

  // ─── Undo ──────────────────────────────────────────────────────────────────

  it('undo returns the previous snapshot', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    expect(stack.undo()).toBe('A')
  })

  it('undo enables redo', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.undo()
    expect(stack.canRedo).toBe(true)
  })

  it('undo past baseline returns null', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    expect(stack.undo()).toBeNull()
  })

  it('multiple undos walk back through history', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.push('D', 'groupMoved')

    expect(stack.undo()).toBe('C')
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')
    expect(stack.undo()).toBeNull()
  })

  // ─── Redo ──────────────────────────────────────────────────────────────────

  it('redo returns the next snapshot', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.undo()
    expect(stack.redo()).toBe('B')
  })

  it('redo with empty redo stack returns null', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    expect(stack.redo()).toBeNull()
  })

  // ─── The critical bug: undo several then redo all ─────────────────────────

  it('undo 3 then redo 3 restores all states correctly', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.push('D', 'groupMoved')

    // Undo all the way back
    expect(stack.undo()).toBe('C')
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')

    // Redo all the way forward
    expect(stack.redo()).toBe('B')
    expect(stack.redo()).toBe('C')
    expect(stack.redo()).toBe('D')
    expect(stack.redo()).toBeNull()
  })

  it('undo 2, redo 1, undo 1 navigates correctly', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.push('D', 'groupMoved')

    expect(stack.undo()).toBe('C') // at C
    expect(stack.undo()).toBe('B') // at B
    expect(stack.redo()).toBe('C') // at C
    expect(stack.undo()).toBe('B') // back to B
    expect(stack.redo()).toBe('C') // at C again
    expect(stack.redo()).toBe('D') // at D
    expect(stack.redo()).toBeNull()
  })

  it('undo then push clears redo (fork)', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')

    stack.undo() // at B
    stack.push('D', 'groupMoved') // fork: C is lost

    expect(stack.canRedo).toBe(false)
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')
    expect(stack.redo()).toBe('B')
    expect(stack.redo()).toBe('D')
    expect(stack.redo()).toBeNull()
  })

  // ─── Interleaved undo/redo with push ───────────────────────────────────────

  it('push after partial redo clears remaining redo', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.push('D', 'groupMoved')

    stack.undo() // at C
    stack.undo() // at B
    stack.redo() // at C

    stack.push('E', 'shapeCreated') // fork at C: D is lost

    expect(stack.canRedo).toBe(false)
    expect(stack.undo()).toBe('C')
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')
  })

  // ─── Max size ──────────────────────────────────────────────────────────────

  it('respects max size, drops oldest entries', () => {
    const stack = new UndoRedoStack(3)
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    // Stack is now [A, B, C] — at max

    stack.push('D', 'groupMoved')
    // A should be dropped: [B, C, D]

    expect(stack.undo()).toBe('C')
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBeNull() // A is gone
  })

  // ─── Debug state ───────────────────────────────────────────────────────────

  it('debugState reflects current stack state', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.undo()

    const state = stack.debugState
    expect(state.undoStack).toHaveLength(2)
    expect(state.redoStack).toHaveLength(1)
    expect(state.cursor).toBe(1)
    expect(state.undoStack[0].label).toBe('initial')
    expect(state.undoStack[1].label).toBe('shapeMoved')
    expect(state.redoStack[0].label).toBe('shapeResized')
  })

  it('debugState returns copies (mutation-safe)', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')

    const state = stack.debugState
    state.undoStack.pop()
    expect(stack.debugState.undoStack).toHaveLength(2) // unchanged
  })

  // ─── Labels ────────────────────────────────────────────────────────────────

  it('preserves labels through undo/redo cycles', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')

    stack.undo() // at B, redo has shapeResized
    stack.undo() // at A, redo has shapeMoved, shapeResized
    stack.redo() // at B
    stack.redo() // at C

    const state = stack.debugState
    expect(state.undoStack.map((e) => e.label)).toEqual(['initial', 'shapeMoved', 'shapeResized'])
    expect(state.redoStack).toHaveLength(0)
  })

  // ─── Rapid undo/redo (stress) ──────────────────────────────────────────────

  it('handles rapid undo/redo toggling without corruption', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')

    for (let i = 0; i < 20; i++) {
      expect(stack.undo()).toBe('B')
      expect(stack.redo()).toBe('C')
    }

    // Should be back at C with full history intact
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')
    expect(stack.redo()).toBe('B')
    expect(stack.redo()).toBe('C')
  })

  // ─── Init resets everything ────────────────────────────────────────────────

  it('init clears all history', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'shapeMoved')
    stack.push('C', 'shapeResized')
    stack.undo()

    stack.init('X')
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
    expect(stack.debugState.undoStack).toHaveLength(1)
    expect(stack.debugState.undoStack[0].json).toBe('X')
  })
})
