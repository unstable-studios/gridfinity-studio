import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutEngine } from './interface'

const MAX_UNDO = 50

/**
 * Engine-snapshot-based undo/redo.
 *
 * Maintains an undo stack of JSON-serialized snapshots, debounce-pushes
 * on shape events, and provides undo/redo callbacks + keyboard shortcuts.
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncCounts = useCallback(() => {
    setCanUndo(undoStackRef.current.length >= 2)
    setCanRedo(redoStackRef.current.length > 0)
  }, [])

  const pushUndo = useCallback(() => {
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

  // Initialize baseline snapshot when engine mounts
  useEffect(() => {
    if (!engine) return
    const baseline = JSON.stringify(engine.toSnapshot())
    undoStackRef.current = [baseline]
    redoStackRef.current = []
    syncCounts()
  }, [engine, syncCounts])

  // Auto-push undo snapshots on shape changes (debounced)
  useEffect(() => {
    if (!engine) return

    const debouncedPush = (): void => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(pushUndo, 500)
    }

    const unsubs = [
      engine.on('shapeCreated', debouncedPush),
      engine.on('shapeDeleted', debouncedPush),
      engine.on('shapeMoved', debouncedPush),
      engine.on('shapeResized', debouncedPush),
      engine.on('groupChanged', debouncedPush),
      engine.on('groupMoved', debouncedPush),
      engine.on('groupResized', debouncedPush)
    ]

    return () => {
      unsubs.forEach((u) => u())
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [engine, pushUndo])

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!engine) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (mod && (e.key === 'Z' || e.key === 'y') && (e.shiftKey || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [engine, undo, redo])

  return { undo, redo, canUndo, canRedo }
}
