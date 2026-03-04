/**
 * React hook wrapping UndoStack for use in components.
 *
 * Provides undo/redo operations that trigger re-renders when the stack changes.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import { UndoStack } from '../lib/undo'
import type { UndoCommand } from '../lib/undo'

interface UseUndoResult {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  pushCommand: (cmd: UndoCommand) => void
  clear: () => void
  lastLabel: string | null
}

interface StackSnapshot {
  canUndo: boolean
  canRedo: boolean
  lastLabel: string | null
}

const EMPTY_SNAPSHOT: StackSnapshot = {
  canUndo: false,
  canRedo: false,
  lastLabel: null
}

function readSnapshot(stack: UndoStack): StackSnapshot {
  return {
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
    lastLabel: stack.lastLabel
  }
}

export function useUndo(): UseUndoResult {
  const stackRef = useRef(new UndoStack())
  const listenersRef = useRef(new Set<() => void>())
  const snapshotRef = useRef<StackSnapshot>(EMPTY_SNAPSHOT)

  const notify = useCallback(() => {
    snapshotRef.current = readSnapshot(stackRef.current)
    for (const listener of listenersRef.current) {
      listener()
    }
  }, [])

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const getSnapshot = useCallback(() => snapshotRef.current, [])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  const pushCommand = useCallback(
    (cmd: UndoCommand) => {
      stackRef.current.push(cmd)
      notify()
    },
    [notify]
  )

  const undo = useCallback(() => {
    stackRef.current.undo()
    notify()
  }, [notify])

  const redo = useCallback(() => {
    stackRef.current.redo()
    notify()
  }, [notify])

  const clear = useCallback(() => {
    stackRef.current.clear()
    notify()
  }, [notify])

  return {
    undo,
    redo,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    pushCommand,
    clear,
    lastLabel: snapshot.lastLabel
  }
}
