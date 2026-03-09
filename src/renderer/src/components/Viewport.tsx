import { useEffect } from 'react'
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
import DrawingToolLayer from './DrawingToolLayer'
import HintCard from './HintCard'

const MOD_KEY = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

// ─── Layout Mode (engine-powered) ──────────────────────────────────────────

function LayoutViewport(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  useEngineUndoRedo(engine) // syncs canUndo/canRedo to useUndoRedo store
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
    </>
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
      </div>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} baseUnit={baseUnit} />
      </div>
      <HintCard />
    </div>
  )
}
