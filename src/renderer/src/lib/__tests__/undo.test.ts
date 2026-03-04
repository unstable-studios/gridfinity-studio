import { describe, it, expect, vi } from 'vitest'
import { UndoStack } from '../undo'
import type { UndoCommand } from '../undo'

function makeCommand(
  id: string,
  label: string,
  exec?: () => void,
  undoFn?: () => void
): UndoCommand {
  return {
    id,
    label,
    execute: exec ?? vi.fn(),
    undo: undoFn ?? vi.fn()
  }
}

describe('UndoStack', () => {
  it('push executes the command and undo restores previous state', () => {
    const stack = new UndoStack()
    let value = 0
    const cmd = makeCommand(
      '1',
      'increment',
      () => (value = 1),
      () => (value = 0)
    )

    stack.push(cmd)
    expect(value).toBe(1)

    stack.undo()
    expect(value).toBe(0)
  })

  it('redo after undo re-applies the command', () => {
    const stack = new UndoStack()
    let value = 0
    const cmd = makeCommand(
      '1',
      'set to 10',
      () => (value = 10),
      () => (value = 0)
    )

    stack.push(cmd)
    stack.undo()
    expect(value).toBe(0)

    stack.redo()
    expect(value).toBe(10)
  })

  it('canUndo and canRedo return correct booleans', () => {
    const stack = new UndoStack()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)

    stack.push(makeCommand('1', 'a'))
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(false)

    stack.undo()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(true)

    stack.redo()
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(false)
  })

  it('maxDepth (100) drops oldest commands when exceeded', () => {
    const stack = new UndoStack()
    const undoFns: ReturnType<typeof vi.fn>[] = []

    for (let i = 0; i < 101; i++) {
      const undoFn = vi.fn()
      undoFns.push(undoFn)
      stack.push(makeCommand(String(i), `cmd-${i}`, vi.fn(), undoFn))
    }

    // The first command (index 0) should have been dropped
    // Undo all 100 remaining commands
    let undoCount = 0
    while (stack.canUndo) {
      stack.undo()
      undoCount++
    }
    expect(undoCount).toBe(100)

    // The oldest command's undo was never called (it was dropped)
    expect(undoFns[0]).not.toHaveBeenCalled()
    // The second command's undo should have been called
    expect(undoFns[1]).toHaveBeenCalled()
  })

  it('clear() empties both past and future stacks', () => {
    const stack = new UndoStack()
    stack.push(makeCommand('1', 'a'))
    stack.push(makeCommand('2', 'b'))
    stack.undo()

    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(true)

    stack.clear()

    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
  })

  it('pushing a new command after undo clears the future stack', () => {
    const stack = new UndoStack()
    stack.push(makeCommand('1', 'a'))
    stack.push(makeCommand('2', 'b'))

    stack.undo()
    expect(stack.canRedo).toBe(true)

    stack.push(makeCommand('3', 'c'))
    expect(stack.canRedo).toBe(false)
  })

  it('undo on empty stack is a no-op', () => {
    const stack = new UndoStack()
    // Should not throw
    stack.undo()
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(false)
  })

  it('redo on empty future is a no-op', () => {
    const stack = new UndoStack()
    stack.push(makeCommand('1', 'a'))
    // Future is empty, redo should do nothing
    stack.redo()
    expect(stack.canUndo).toBe(true)
    expect(stack.canRedo).toBe(false)
  })

  it('lastLabel returns the label of the most recent past command', () => {
    const stack = new UndoStack()
    expect(stack.lastLabel).toBeNull()

    stack.push(makeCommand('1', 'first'))
    expect(stack.lastLabel).toBe('first')

    stack.push(makeCommand('2', 'second'))
    expect(stack.lastLabel).toBe('second')

    stack.undo()
    expect(stack.lastLabel).toBe('first')

    stack.undo()
    expect(stack.lastLabel).toBeNull()
  })
})
