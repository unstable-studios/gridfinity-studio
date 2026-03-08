import { useEffect, useCallback, useRef, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import ReviewCanvas from './review/ReviewCanvas'
import {
  LayoutEngineProvider,
  LayoutEngineCanvas,
  useLayoutEngineContext,
  useEngineUndoRedo,
  useEngineState,
  useProjectEngineSync,
  useBinArtwork
} from '@/layout-engine'
import HintCard from './HintCard'

// ─── Sandbox helpers (only used in sandbox mode) ────────────────────────────

const SANDBOX_STORAGE_KEY = 'gfstudio:sandbox-snapshot'

let shapeCounter = 0

function regularPolygon(sides: number, radius: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2
    pts.push({
      x: Math.round(Math.cos(angle) * radius * 100) / 100,
      y: Math.round(Math.sin(angle) * radius * 100) / 100
    })
  }
  return pts
}

const STAR_PATH =
  'M 0,-40 L 9.51,-12.36 L 38.04,-12.36 L 15.27,4.72 L 23.51,32.36 L 0,16.18 L -23.51,32.36 L -15.27,4.72 L -38.04,-12.36 L -9.51,-12.36 Z'

// ─── Layout Mode (engine-powered) ──────────────────────────────────────────

function LayoutViewport(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  const { canUndo, canRedo } = useEngineUndoRedo(engine)
  const { tick } = useEngineState()
  useProjectEngineSync()

  // Wire grid config from gridfinity settings
  const project = useProject((s) => s.project)
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  useEffect(() => {
    if (!engine) return
    engine.setGridConfig({ size: baseUnit, enabled: true, visible: true })
  }, [engine, baseUnit])

  // Render bin detail artwork (magnet holes, screw holes, lip boundary)
  useBinArtwork(engine, project?.gridfinity, tick)

  // Delete key for selected shapes
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!engine) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const ids = engine.getSelectedIds()
        if (ids.length === 0) return
        engine.clearSelection()
        for (const id of ids) {
          if (engine.getGroup(id)) {
            engine.removeGroup(id)
          } else {
            engine.removeShape(id)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [engine])

  // Status indicator
  const statusClass =
    'absolute bottom-2 right-2 z-10 rounded px-2 py-0.5 text-[10px] text-zinc-500 bg-zinc-100/80 dark:text-zinc-500 dark:bg-zinc-900/80'

  return (
    <>
      <div className={statusClass}>
        {canUndo ? 'Ctrl+Z undo' : ''} {canRedo ? '| Ctrl+Shift+Z redo' : ''}
      </div>
    </>
  )
}

// ─── Sandbox Mode (engine-powered with toolbar) ─────────────────────────────

const MAX_UNDO = 50

function SandboxToolbar(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const isUndoingRef = useRef(false)
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  const pushUndo = useCallback(() => {
    if (!engine || isUndoingRef.current) return
    const json = JSON.stringify(engine.toSnapshot())
    const stack = undoStackRef.current
    if (stack[stack.length - 1] === json) return
    stack.push(json)
    if (stack.length > MAX_UNDO) stack.shift()
    redoStackRef.current = []
    setUndoLen(stack.length)
    setRedoLen(0)
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, json)
    } catch {
      // ignore
    }
  }, [engine])

  const undo = useCallback(() => {
    if (!engine || undoStackRef.current.length < 2) return
    isUndoingRef.current = true
    redoStackRef.current.push(undoStackRef.current.pop()!)
    const json = undoStackRef.current[undoStackRef.current.length - 1]
    engine.loadSnapshot(JSON.parse(json))
    setUndoLen(undoStackRef.current.length)
    setRedoLen(redoStackRef.current.length)
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, json)
    } catch {
      // ignore
    }
    isUndoingRef.current = false
  }, [engine])

  const redo = useCallback(() => {
    if (!engine || redoStackRef.current.length === 0) return
    isUndoingRef.current = true
    undoStackRef.current.push(JSON.stringify(engine.toSnapshot()))
    const json = redoStackRef.current.pop()!
    engine.loadSnapshot(JSON.parse(json))
    setUndoLen(undoStackRef.current.length)
    setRedoLen(redoStackRef.current.length)
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, json)
    } catch {
      // ignore
    }
    isUndoingRef.current = false
  }, [engine])

  useEffect(() => {
    if (!engine) return
    try {
      const raw = localStorage.getItem(SANDBOX_STORAGE_KEY)
      if (!raw) return
      const snapshot = JSON.parse(raw)
      if (snapshot?.shapes?.length > 0) {
        engine.loadSnapshot(snapshot)
        shapeCounter = snapshot.shapes.length
      }
    } catch {
      // ignore
    }
    const baseline = JSON.stringify(engine.toSnapshot())
    undoStackRef.current = [baseline]
    redoStackRef.current = []
    setUndoLen(1)
    setRedoLen(0)
  }, [engine])

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
      engine.on('shapeResized', debouncedPush)
    ]
    return () => {
      unsubs.forEach((u) => u())
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [engine, pushUndo])

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
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const ids = engine.getSelectedIds()
        if (ids.length === 0) return
        engine.clearSelection()
        for (const id of ids) {
          if (engine.getGroup(id)) {
            engine.removeGroup(id)
          } else {
            engine.removeShape(id)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [engine, undo, redo])

  const addShape = useCallback(
    (type: 'rect' | 'circle' | 'triangle' | 'hexagon' | 'star') => {
      if (!engine) return
      shapeCounter++
      const offset = (shapeCounter % 10) * 20
      const baseX = 120 + offset
      const baseY = 120 + offset
      const common = {
        rotation: 0,
        fill: 'rgba(96, 165, 250, 0.15)',
        stroke: '#60a5fa',
        strokeWidth: 1,
        groupId: null
      }
      switch (type) {
        case 'rect':
          engine.addShape({
            ...common,
            id: `rect-${shapeCounter}`,
            type: 'rect',
            x: baseX,
            y: baseY,
            width: 168,
            height: 168,
            cornerRadius: 4
          })
          break
        case 'circle':
          engine.addShape({
            ...common,
            id: `circle-${shapeCounter}`,
            type: 'circle',
            x: baseX,
            y: baseY,
            radiusX: 42,
            radiusY: 42
          })
          break
        case 'triangle':
          engine.addShape({
            ...common,
            id: `tri-${shapeCounter}`,
            type: 'polygon',
            x: baseX,
            y: baseY,
            points: regularPolygon(3, 60)
          })
          break
        case 'hexagon':
          engine.addShape({
            ...common,
            id: `hex-${shapeCounter}`,
            type: 'polygon',
            x: baseX,
            y: baseY,
            points: regularPolygon(6, 50)
          })
          break
        case 'star':
          engine.addShape({
            ...common,
            id: `star-${shapeCounter}`,
            type: 'svgPath',
            x: baseX,
            y: baseY,
            pathData: STAR_PATH
          })
          break
      }
    },
    [engine]
  )

  const resetView = useCallback(() => {
    engine?.resetView()
  }, [engine])

  const resetSandbox = useCallback(() => {
    if (!engine) return
    engine.clearSelection()
    for (const shape of engine.getAllShapes()) {
      engine.removeShape(shape.id)
    }
    for (const group of engine.getAllGroups()) {
      engine.removeGroup(group.id)
    }
    engine.resetView()
    localStorage.removeItem(SANDBOX_STORAGE_KEY)
    undoStackRef.current = []
    redoStackRef.current = []
    setUndoLen(0)
    setRedoLen(0)
    shapeCounter = 0
  }, [engine])

  const btnClass =
    'cursor-pointer rounded px-2 py-0.5 text-xs transition-colors text-zinc-600 bg-zinc-200 hover:bg-zinc-300 dark:text-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600'

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded border border-zinc-300 bg-zinc-100 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
      <button onClick={() => addShape('rect')} className={btnClass}>
        + Rect
      </button>
      <button onClick={() => addShape('circle')} className={btnClass}>
        + Ellipse
      </button>
      <button onClick={() => addShape('triangle')} className={btnClass}>
        + Tri
      </button>
      <button onClick={() => addShape('hexagon')} className={btnClass}>
        + Hex
      </button>
      <button onClick={() => addShape('star')} className={btnClass}>
        + Star
      </button>
      <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
      <button
        onClick={undo}
        disabled={undoLen === 0}
        className={btnClass + ' disabled:opacity-30 disabled:cursor-default'}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={redo}
        disabled={redoLen === 0}
        className={btnClass + ' disabled:opacity-30 disabled:cursor-default'}
        title="Redo (Ctrl+Shift+Z)"
      >
        Redo
      </button>
      <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
      <button onClick={resetView} className={btnClass}>
        Reset View
      </button>
      <button
        onClick={resetSandbox}
        className="cursor-pointer rounded px-2 py-0.5 text-xs transition-colors text-red-600 bg-zinc-200 hover:bg-red-100 dark:text-red-400 dark:bg-zinc-700 dark:hover:bg-red-900/30"
      >
        Clear All
      </button>
    </div>
  )
}

// ─── Main Viewport ──────────────────────────────────────────────────────────

export default function Viewport(): React.JSX.Element {
  const { mode, engineType } = useAppMode()
  const { project, bakeResults } = useProject()

  const baseUnit = project?.gridfinity.baseUnit ?? 42

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Layout canvas always mounted so engine survives mode switches */}
      <div
        className={
          mode === 'layout' ? 'relative h-full' : 'absolute inset-0 invisible pointer-events-none'
        }
      >
        <LayoutEngineCanvas />
        {mode === 'layout' && <LayoutViewport />}
      </div>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} baseUnit={baseUnit} />
      </div>
      {mode === 'sandbox' && (
        <div className="relative h-full">
          <LayoutEngineProvider engineType={engineType}>
            <LayoutEngineCanvas />
            <SandboxToolbar />
          </LayoutEngineProvider>
        </div>
      )}
      <HintCard />
    </div>
  )
}
