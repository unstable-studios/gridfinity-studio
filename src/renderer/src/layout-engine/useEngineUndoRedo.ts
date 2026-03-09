import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import type { LayoutEngine } from './interface'

const MAX_UNDO = 50

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
} {
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const isUndoingRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncCounts = useCallback(() => {
    setCanUndo(undoStackRef.current.length >= 2)
    setCanRedo(redoStackRef.current.length > 0)
  }, [])

  const pushSnapshot = useCallback(() => {
    if (!engine || isUndoingRef.current) return
    const json = JSON.stringify(engine.toSnapshot())
    const stack = undoStackRef.current
    if (stack[stack.length - 1] === json) return
    stack.push(json)
    if (stack.length > MAX_UNDO) stack.shift()
    redoStackRef.current = []
    syncCounts()
  }, [engine, syncCounts])

  const undo = useCallback(() => {
    if (!engine || undoStackRef.current.length < 2) return
    isUndoingRef.current = true
    redoStackRef.current.push(undoStackRef.current.pop()!)
    const json = undoStackRef.current[undoStackRef.current.length - 1]
    engine.loadSnapshot(JSON.parse(json))
    syncCounts()
    isUndoingRef.current = false
  }, [engine, syncCounts])

  const redo = useCallback(() => {
    if (!engine || redoStackRef.current.length === 0) return
    isUndoingRef.current = true
    undoStackRef.current.push(JSON.stringify(engine.toSnapshot()))
    const json = redoStackRef.current.pop()!
    engine.loadSnapshot(JSON.parse(json))
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
    undoStackRef.current = [baseline]
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
      engine.on('shapeMoved', pushSnapshot),
      engine.on('shapeResized', pushSnapshot),
      engine.on('groupMoved', pushSnapshot),
      engine.on('groupResized', pushSnapshot),
      engine.on('shapeCreated', pushSnapshot),
      engine.on('shapeDeleted', pushSnapshot),
      engine.on('groupChanged', pushSnapshot)
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

  return { undo, redo, canUndo, canRedo }
}
