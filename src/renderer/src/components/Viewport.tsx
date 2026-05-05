import { useEffect, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import ReviewCanvas from './review/ReviewCanvas'
import {
  LayoutEngineCanvas,
  useLayoutEngineContext,
  useEngineUndoRedo,
  useEngineState,
  useProjectEngineSync,
  useBinArtwork
} from '@/layout-engine'
import type { UndoRedoDebugState } from '@/layout-engine/useEngineUndoRedo'
import DrawingToolLayer from './DrawingToolLayer'
import ShapeTooltip from './ShapeTooltip'
import HintCard from './HintCard'

const MOD_KEY = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

// ─── Layout Mode (engine-powered) ──────────────────────────────────────────

function LayoutViewport(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  const { debugState } = useEngineUndoRedo(engine)
  const canUndo = useUndoRedo((s) => s.canUndo)
  const canRedo = useUndoRedo((s) => s.canRedo)
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
        {canUndo ? `${MOD_KEY}+Z undo` : ''} {canRedo ? `| ${MOD_KEY}+Shift+Z redo` : ''}
      </div>
      {import.meta.env.DEV && <UndoRedoDebugOverlay debugState={debugState} />}
    </>
  )
}

// ─── Undo/Redo Debug Overlay (dev only) ──────────────────────────────────────

function UndoRedoDebugOverlay({ debugState }: { debugState: UndoRedoDebugState }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-10 right-2 z-20 rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        U:{debugState.undoStack.length} R:{debugState.redoStack.length}
      </button>
    )
  }

  const { undoStack, redoStack, cursor } = debugState

  return (
    <div className="absolute bottom-10 right-2 z-20 w-56 max-h-72 overflow-y-auto rounded border border-zinc-700 bg-zinc-900/95 text-[10px] font-mono text-zinc-300 shadow-lg">
      <div className="sticky top-0 flex items-center justify-between border-b border-zinc-700 bg-zinc-900 px-2 py-1">
        <span className="font-semibold text-zinc-100">Undo/Redo Stack</span>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
          ×
        </button>
      </div>
      {redoStack.length > 0 && (
        <div className="border-b border-zinc-800 px-2 py-1">
          <div className="text-zinc-500 mb-0.5">Redo ({redoStack.length})</div>
          {[...redoStack].reverse().map((entry, i) => (
            <div key={`r-${i}`} className="flex gap-1.5 text-amber-400/70 py-px">
              <span className="text-zinc-600 w-4 text-right shrink-0">{redoStack.length - i}</span>
              <span>{entry.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="px-2 py-1">
        <div className="text-zinc-500 mb-0.5">Undo ({undoStack.length})</div>
        {[...undoStack].reverse().map((entry, i) => {
          const stackIdx = undoStack.length - 1 - i
          const isCurrent = stackIdx === cursor
          return (
            <div
              key={`u-${i}`}
              className={`flex gap-1.5 py-px ${isCurrent ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}`}
            >
              <span className="text-zinc-600 w-4 text-right shrink-0">{stackIdx}</span>
              <span>{entry.label}</span>
              {isCurrent && <span className="text-emerald-600">◀</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Viewport ──────────────────────────────────────────────────────────

export default function Viewport(): React.JSX.Element {
  const { mode } = useAppMode()
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
        {mode === 'layout' && <DrawingToolLayer />}
        {mode === 'layout' && <ShapeTooltip />}
      </div>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} baseUnit={baseUnit} />
      </div>
      <HintCard />
    </div>
  )
}
