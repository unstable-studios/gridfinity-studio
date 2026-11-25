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

  // ─── History ───────────────────────────────────────────────────────────────

  it('lists every step oldest first, with redo steps after the current one', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'Add bin')
    stack.push('C', 'Move bin')
    stack.push('D', 'Delete bin')
    stack.undo()
    stack.undo()

    expect(stack.history).toEqual({
      labels: ['Start', 'Add bin', 'Move bin', 'Delete bin'],
      current: 1
    })
  })

  it('has no steps before it is given a start', () => {
    expect(new UndoRedoStack().history).toEqual({ labels: [], current: -1 })
  })

  it('keeps labels through undo and redo', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'Add bin')
    stack.push('C', 'Move bin')
    stack.undo()
    stack.undo()
    stack.redo()
    stack.redo()

    expect(stack.history).toEqual({ labels: ['Start', 'Add bin', 'Move bin'], current: 2 })
  })

  // ─── Going straight to a step ──────────────────────────────────────────────

  it('goes back several steps at once', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'one')
    stack.push('C', 'two')
    stack.push('D', 'three')

    expect(stack.goTo(1)).toBe('B')
    expect(stack.history).toEqual({ labels: ['Start', 'one', 'two', 'three'], current: 1 })
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(true)
    // Undo and redo carry on from there.
    expect(stack.redo()).toBe('C')
    expect(stack.undo()).toBe('B')
    expect(stack.undo()).toBe('A')
  })

  it('goes forward several steps at once, and to either end', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'one')
    stack.push('C', 'two')
    stack.push('D', 'three')

    expect(stack.goTo(0)).toBe('A')
    expect(stack.canUndo).toBe(false)
    expect(stack.goTo(3)).toBe('D')
    expect(stack.canRedo).toBe(false)
    expect(stack.goTo(2)).toBe('C')
    expect(stack.history.current).toBe(2)
  })

  it('does nothing for the current step or a step that is not there', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'one')

    for (const index of [1, -1, 2, 0.5, NaN]) {
      expect(stack.goTo(index), String(index)).toBeNull()
      expect(stack.history.current).toBe(1)
    }
  })

  it('drops the steps after the one gone back to when a new change is made', () => {
    const stack = new UndoRedoStack()
    stack.init('A')
    stack.push('B', 'one')
    stack.push('C', 'two')
    stack.goTo(0)
    stack.push('X', 'other')

    expect(stack.history).toEqual({ labels: ['Start', 'other'], current: 1 })
  })

  it('knows the snapshot the layout is at', () => {
    const stack = new UndoRedoStack()
    expect(stack.currentJson).toBeNull()
    stack.init('A')
    stack.push('B', 'one')
    expect(stack.currentJson).toBe('B')
    stack.undo()
    expect(stack.currentJson).toBe('A')
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
    expect(stack.history).toEqual({ labels: ['Start'], current: 0 })
    expect(stack.currentJson).toBe('X')
  })
})
