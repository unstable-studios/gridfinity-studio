import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useSharedSelection } from '@/hooks/useSelection'
import { useSnapping } from '@/hooks/useSnapping'
import LayoutCanvas from './layout/LayoutCanvas'
import ReviewCanvas from './review/ReviewCanvas'
import { LayoutEngineProvider, useLayoutEngineContext } from '@/layout-engine'
import HintCard from './HintCard'
import type { Entity, Bin } from '../../../shared/types/project'
import { entityCenter } from '../../../shared/geometry/entity-geometry'

const SANDBOX_STORAGE_KEY = 'gfstudio:sandbox-snapshot'

let shapeCounter = 0

/** Generate regular polygon points centered at origin */
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

/** Star SVG path centered at origin */
const STAR_PATH =
  'M 0,-40 L 9.51,-12.36 L 38.04,-12.36 L 15.27,4.72 L 23.51,32.36 L 0,16.18 L -23.51,32.36 L -15.27,4.72 L -38.04,-12.36 L -9.51,-12.36 Z'

const MAX_UNDO = 50

function EngineToolbar(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const isUndoingRef = useRef(false)
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  // Push current state onto undo stack
  const pushUndo = useCallback(() => {
    if (!engine || isUndoingRef.current) return
    const json = JSON.stringify(engine.toSnapshot())
    const stack = undoStackRef.current
    if (stack[stack.length - 1] === json) return // no change
    stack.push(json)
    if (stack.length > MAX_UNDO) stack.shift()
    redoStackRef.current = []
    setUndoLen(stack.length)
    setRedoLen(0)
    // Also persist to localStorage
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, json)
    } catch {
      // ignore
    }
  }, [engine])

  const undo = useCallback(() => {
    if (!engine || undoStackRef.current.length === 0) return
    isUndoingRef.current = true
    // Save current state to redo
    redoStackRef.current.push(JSON.stringify(engine.toSnapshot()))
    const json = undoStackRef.current.pop()!
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
    // Save current state to undo
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

  // Restore sandbox state from localStorage on engine mount
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
      // Ignore corrupt data
    }
    // Initialize undo stack with initial state
    undoStackRef.current = []
    redoStackRef.current = []
    setUndoLen(0)
    setRedoLen(0)
  }, [engine])

  // Auto-push undo snapshots on changes (debounced)
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

  // Keyboard shortcuts: Delete, Undo (Ctrl+Z), Redo (Ctrl+Shift+Z / Ctrl+Y)
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
          engine.removeShape(id)
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

export default function Viewport(): React.JSX.Element {
  const { mode, engineType } = useAppMode()
  const {
    project,
    addEntity,
    updateEntity,
    moveEntity,
    removeEntity,
    updateBin,
    moveBin,
    removeBin,
    bakeResults
  } = useProject()
  const selection = useSharedSelection()
  const snapping = useSnapping()

  const entities = useMemo(() => project?.entities ?? [], [project?.entities])
  const bins = useMemo(() => project?.bins ?? [], [project?.bins])
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  const handlePlace = (partial: Partial<Entity> & { type: Entity['type'] }): void => {
    // Entity center is always transform.position (polygons are now normalized)
    const cx = partial.transform?.position?.x ?? 0
    const cy = partial.transform?.position?.y ?? 0
    let targetBinId: string | undefined

    for (const bin of bins) {
      const bx = bin.position.x
      const by = bin.position.y
      const bw = bin.width * baseUnit
      const bd = bin.depth * baseUnit
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bd) {
        targetBinId = bin.id
        break
      }
    }

    const entity = addEntity(partial, targetBinId)
    selection.select(entity.id)
  }

  const handleMove = (id: string, dx: number, dy: number): void => {
    moveEntity(id, dx, dy)
  }

  /** After drag ends, reassign moved entities to whatever bin contains their center. */
  const handleMoveEnd = useCallback(
    (movedIds: Set<string>) => {
      for (const entityId of movedIds) {
        const entity = entities.find((e) => e.id === entityId)
        if (!entity) continue
        const { x: cx, y: cy } = entityCenter(entity)

        // Find the bin whose footprint contains the entity center
        let targetBin: Bin | undefined
        for (const bin of bins) {
          const bx = bin.position.x
          const by = bin.position.y
          const bw = bin.width * baseUnit
          const bd = bin.depth * baseUnit
          if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bd) {
            targetBin = bin
            break
          }
        }

        // Remove entity from any bin it's currently in
        for (const bin of bins) {
          if (bin.entityIds.includes(entityId)) {
            if (targetBin?.id === bin.id) {
              // Already in the right bin — no change needed
              targetBin = undefined
              break
            }
            updateBin(bin.id, { entityIds: bin.entityIds.filter((id) => id !== entityId) })
          }
        }

        // Add to the target bin (if it changed)
        if (targetBin) {
          updateBin(targetBin.id, { entityIds: [...targetBin.entityIds, entityId] })
        }
      }
    },
    [entities, bins, baseUnit, updateBin]
  )

  const handleResize = (id: string, patch: Partial<Entity>): void => {
    updateEntity(id, patch)
  }

  const handleBinMove = (id: string, dx: number, dy: number): void => {
    moveBin(id, dx, dy)
  }

  const handleBinResize = (id: string, patch: Partial<Bin>): void => {
    updateBin(id, patch)
  }

  const snapFn = (pos: { x: number; y: number }): { x: number; y: number } => {
    const others = entities.filter((e) => !selection.selectedIds.has(e.id))
    return snapping.snap(pos, baseUnit, others)
  }

  const handleDelete = useCallback(() => {
    if (selection.selectedIds.size === 0) return
    for (const id of selection.selectedIds) {
      if (selection.selectionType === 'entity') {
        removeEntity(id)
      } else {
        removeBin(id)
      }
    }
    selection.clearSelection()
  }, [selection, removeEntity, removeBin])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        e.preventDefault()
        handleDelete()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleDelete])

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-linear-to-b from-zinc-100/50 via-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-900 dark:to-zinc-900/70">
      <div className={mode === 'layout' ? 'h-full' : 'hidden'}>
        <LayoutCanvas
          entities={entities}
          bins={bins}
          selectedIds={selection.selectedIds}
          selectionType={selection.selectionType}
          baseUnit={baseUnit}
          gridfinityConfig={project?.gridfinity}
          onPlace={handlePlace}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          onResize={handleResize}
          onBinMove={handleBinMove}
          onBinResize={handleBinResize}
          onSelect={selection.select}
          onSelectBin={selection.selectBin}
          onMarqueeSelect={selection.marqueeSelect}
          onClearSelection={selection.clearSelection}
          snap={snapFn}
        />
      </div>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} bins={bins} baseUnit={baseUnit} />
      </div>
      {mode === 'sandbox' && (
        <div className="relative h-full">
          <LayoutEngineProvider engineType={engineType}>
            <EngineToolbar />
          </LayoutEngineProvider>
        </div>
      )}
      <HintCard />
    </div>
  )
}
