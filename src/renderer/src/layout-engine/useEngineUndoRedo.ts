import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { UndoRedoStack } from './undo-redo-stack'
import type { UndoRedoDebugState } from './undo-redo-stack'
import type { LayoutEngine } from './interface'

export type { UndoEntry, UndoRedoDebugState } from './undo-redo-stack'

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
  debugState: UndoRedoDebugState
} {
  const stackRef = useRef(new UndoRedoStack())
  const isUndoingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [debugState, setDebugState] = useState<UndoRedoDebugState>({
    undoStack: [],
    redoStack: [],
    cursor: -1
  })

  const syncState = useCallback(() => {
    const s = stackRef.current
    setCanUndo(s.canUndo)
    setCanRedo(s.canRedo)
    setDebugState(s.debugState)
  }, [])

  const pushSnapshot = useCallback(
    (label: string) => {
      if (!engine || isUndoingRef.current) return
      const json = JSON.stringify(engine.toSnapshot())
      stackRef.current.push(json, label)
      syncState()
    },
    [engine, syncState]
  )

  const undo = useCallback(() => {
    if (!engine) return
    isUndoingRef.current = true
    const json = stackRef.current.undo()
    if (json) engine.loadSnapshot(JSON.parse(json))
    syncState()
    isUndoingRef.current = false
  }, [engine, syncState])

  const redo = useCallback(() => {
    if (!engine) return
    isUndoingRef.current = true
    const json = stackRef.current.redo()
    if (json) engine.loadSnapshot(JSON.parse(json))
    syncState()
    isUndoingRef.current = false
  }, [engine, syncState])

  // Sync state to zustand store so Navbar can read it
  useEffect(() => {
    useUndoRedo.setState({ canUndo, canRedo, undo, redo })
  }, [canUndo, canRedo, undo, redo])

  // Initialize baseline snapshot when engine mounts
  useEffect(() => {
    if (!engine) return
    stackRef.current.init(JSON.stringify(engine.toSnapshot()))
    syncState()
  }, [engine, syncState])

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
