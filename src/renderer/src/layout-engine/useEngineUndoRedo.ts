import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import type { LayoutEngine } from './interface'

const MAX_UNDO = 50

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

/**
 * Engine-snapshot-based undo/redo.
 *
 * Captures undo snapshots on every engine mutation event. The
 * `isUndoingRef` guard prevents undo/redo restores (which fire
 * engine events during loadSnapshot) from being recorded as new
 * mutations, and the JSON equality check deduplicates redundant
 * pushes from burst events.
 *
 * Also syncs canUndo/canRedo/undo/redo to the useUndoRedo zustand store
 * so the Navbar and other distant consumers can read undo/redo state.
 */
export function useEngineUndoRedo(engine: LayoutEngine | null): {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  debugState: UndoRedoDebugState
} {
  const undoStackRef = useRef<UndoEntry[]>([])
  const redoStackRef = useRef<UndoEntry[]>([])
  const isUndoingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [debugState, setDebugState] = useState<UndoRedoDebugState>({
    undoStack: [],
    redoStack: [],
    cursor: -1
  })

  const syncCounts = useCallback(() => {
    setCanUndo(undoStackRef.current.length >= 2)
    setCanRedo(redoStackRef.current.length > 0)
    setDebugState({
      undoStack: [...undoStackRef.current],
      redoStack: [...redoStackRef.current],
      cursor: undoStackRef.current.length - 1
    })
  }, [])

  const pushSnapshot = useCallback(
    (label: string) => {
      if (!engine || isUndoingRef.current) return
      const json = JSON.stringify(engine.toSnapshot())
      const stack = undoStackRef.current
      if (stack.length > 0 && stack[stack.length - 1].json === json) return
      stack.push({ json, label })
      if (stack.length > MAX_UNDO) stack.shift()
      redoStackRef.current = []
      syncCounts()
    },
    [engine, syncCounts]
  )

  const undo = useCallback(() => {
    if (!engine || undoStackRef.current.length < 2) return
    isUndoingRef.current = true
    redoStackRef.current.push(undoStackRef.current.pop()!)
    const entry = undoStackRef.current[undoStackRef.current.length - 1]
    engine.loadSnapshot(JSON.parse(entry.json))
    syncCounts()
    isUndoingRef.current = false
  }, [engine, syncCounts])

  const redo = useCallback(() => {
    if (!engine || redoStackRef.current.length === 0) return
    isUndoingRef.current = true
    const currentJson = JSON.stringify(engine.toSnapshot())
    const currentLabel = undoStackRef.current[undoStackRef.current.length - 1]?.label ?? 'unknown'
    undoStackRef.current.push({ json: currentJson, label: currentLabel })
    const entry = redoStackRef.current.pop()!
    engine.loadSnapshot(JSON.parse(entry.json))
    syncCounts()
    isUndoingRef.current = false
  }, [engine, syncCounts])

  // Sync state to zustand store so Navbar can read it
  useEffect(() => {
    useUndoRedo.setState({ canUndo, canRedo, undo, redo })
  }, [canUndo, canRedo, undo, redo])

  // Initialize baseline snapshot when engine mounts
  useEffect(() => {
    if (!engine) return
    const baseline = JSON.stringify(engine.toSnapshot())
    undoStackRef.current = [{ json: baseline, label: 'initial' }]
    redoStackRef.current = []
    syncCounts()
  }, [engine, syncCounts])

  // Subscribe to engine events for undo snapshot capture.
  // All events push synchronously — the isUndoingRef guard prevents
  // undo/redo restores from being recorded, and JSON equality dedup
  // handles any burst events (e.g. loadSnapshot firing multiple events).
  useEffect(() => {
    if (!engine) return

    const unsubs = [
      engine.on('shapeMoved', () => pushSnapshot('shapeMoved')),
      engine.on('shapeResized', () => pushSnapshot('shapeResized')),
      engine.on('groupMoved', () => pushSnapshot('groupMoved')),
      engine.on('groupResized', () => pushSnapshot('groupResized')),
      engine.on('shapeCreated', () => pushSnapshot('shapeCreated')),
      engine.on('shapeDeleted', () => pushSnapshot('shapeDeleted')),
      engine.on('groupChanged', () => pushSnapshot('groupChanged'))
    ]

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

  return { undo, redo, canUndo, canRedo, debugState }
}
