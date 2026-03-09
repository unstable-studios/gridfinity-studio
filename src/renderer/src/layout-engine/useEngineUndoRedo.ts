import { useCallback, useEffect, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import type { LayoutEngine } from './interface'

const MAX_UNDO = 50
const DEBOUNCE_MS = 300

/**
 * Engine-snapshot-based undo/redo.
 *
 * Captures undo snapshots at interaction boundaries:
 * - shapeMoved, shapeResized, groupMoved, groupResized fire once at the
 *   end of a drag/resize in both engines → push immediately.
 * - shapeCreated, shapeDeleted, groupChanged are discrete actions but may
 *   fire in rapid bursts (e.g. loadSnapshot) → push with short debounce.
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const debouncedPush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(pushSnapshot, DEBOUNCE_MS)
  }, [pushSnapshot])

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

  // Subscribe to engine events for undo snapshot capture
  useEffect(() => {
    if (!engine) return

    // Interaction-end events fire once per completed drag/resize.
    // Push immediately — no debounce needed.
    const interactionUnsubs = [
      engine.on('shapeMoved', pushSnapshot),
      engine.on('shapeResized', pushSnapshot),
      engine.on('groupMoved', pushSnapshot),
      engine.on('groupResized', pushSnapshot)
    ]

    // Discrete/bulk events may fire in bursts (e.g. loadSnapshot removes
    // then recreates everything). Debounce to coalesce into one snapshot.
    const discreteUnsubs = [
      engine.on('shapeCreated', debouncedPush),
      engine.on('shapeDeleted', debouncedPush),
      engine.on('groupChanged', debouncedPush)
    ]

    return () => {
      interactionUnsubs.forEach((u) => u())
      discreteUnsubs.forEach((u) => u())
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [engine, pushSnapshot, debouncedPush])

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
