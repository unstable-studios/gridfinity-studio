import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { flushPendingCommits } from '@/lib/pending-commits'
import { describeChange } from '@/lib/describe-change'
import { UndoRedoStack } from './undo-redo-stack'
import type { UndoHistory } from './undo-redo-stack'
import type { LayoutEngine } from './interface'
import type { LayoutSnapshot } from './types'

/**
 * Engine-snapshot-based undo/redo.
 *
 * Uses UndoRedoStack for pure stack logic. This hook wires it to engine
 * events and syncs state to the useUndoRedo zustand store so Navbar and
 * other distant consumers can read undo/redo state.
 */
export function useEngineUndoRedo(engine: LayoutEngine | null): {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const stackRef = useRef(new UndoRedoStack())
  const isUndoingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [history, setHistory] = useState<UndoHistory>({ labels: [], current: -1 })

  const syncState = useCallback(() => {
    const s = stackRef.current
    setCanUndo(s.canUndo)
    setCanRedo(s.canRedo)
    setHistory(s.history)
  }, [])

  const pushSnapshot = useCallback(() => {
    if (!engine || isUndoingRef.current) return
    const snapshot = engine.toSnapshot()
    const json = JSON.stringify(snapshot)
    const before = stackRef.current.currentJson
    // Several events can report one change. The stack keeps the first and drops the rest,
    // so only a snapshot that differs needs a name.
    if (before === json) return
    // The step is named for what it did, whichever event reported it.
    const label = before ? describeChange(JSON.parse(before) as LayoutSnapshot, snapshot) : ''
    stackRef.current.push(json, label)
    syncState()
  }, [engine, syncState])

  const undo = useCallback(() => {
    if (!engine) return
    // An adjustment still waiting to be recorded becomes the step to undo.
    flushPendingCommits()
    isUndoingRef.current = true
    const json = stackRef.current.undo()
    if (json) engine.loadSnapshot(JSON.parse(json))
    syncState()
    isUndoingRef.current = false
  }, [engine, syncState])

  const redo = useCallback(() => {
    if (!engine) return
    flushPendingCommits()
    isUndoingRef.current = true
    const json = stackRef.current.redo()
    if (json) engine.loadSnapshot(JSON.parse(json))
    syncState()
    isUndoingRef.current = false
  }, [engine, syncState])

  const goTo = useCallback(
    (index: number) => {
      if (!engine) return
      flushPendingCommits()
      isUndoingRef.current = true
      const json = stackRef.current.goTo(index)
      if (json) engine.loadSnapshot(JSON.parse(json))
      syncState()
      isUndoingRef.current = false
    },
    [engine, syncState]
  )

  const reset = useCallback(() => {
    if (!engine) return
    stackRef.current.init(JSON.stringify(engine.toSnapshot()))
    syncState()
  }, [engine, syncState])

  // Sync state to zustand store so Navbar and useProjectEngineSync can use it
  useEffect(() => {
    useUndoRedo.setState({ canUndo, canRedo, undo, redo, reset, history, goTo })
  }, [canUndo, canRedo, undo, redo, reset, history, goTo])

  // Initialize baseline snapshot when engine mounts
  useEffect(() => {
    reset()
  }, [reset])

  // Subscribe to engine events for undo snapshot capture.
  // All events push synchronously — the isUndoingRef guard prevents
  // undo/redo restores from being recorded, and JSON equality dedup
  // handles any burst events (e.g. loadSnapshot firing multiple events).
  useEffect(() => {
    if (!engine) return

    const events = [
      'shapeMoved',
      'shapeResized',
      'groupMoved',
      'groupResized',
      'shapeCreated',
      'shapeDeleted',
      'shapeUpdated',
      'groupChanged'
    ] as const
    const unsubs = events.map((event) => engine.on(event, pushSnapshot))

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [engine, pushSnapshot])

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!engine) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      const mod = e.metaKey || e.ctrlKey

      if (mod && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (mod && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [engine, undo, redo])

  return { undo, redo, canUndo, canRedo }
}
