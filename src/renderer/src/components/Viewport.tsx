import { useEffect, useState } from 'react'
import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useBedMarks } from '@/hooks/useBedMarks'
import ReviewCanvas from './review/ReviewCanvas'
import {
  LayoutEngineCanvas,
  useLayoutEngineContext,
  useEngineUndoRedo,
  useEngineState,
  useProjectEngineSync,
  useBinArtwork,
  useLayoutEngine
} from '@/layout-engine'
import DrawingToolLayer from './DrawingToolLayer'
import EditContextMenu from './EditContextMenu'
import { removeItems } from '@/lib/remove-items'
import ShapeTooltip from './ShapeTooltip'
import HintCard from './HintCard'
import HistoryPanel from './HistoryPanel'
import { MOD_KEY } from '@/lib/platform'

// ─── Layout Mode (engine-powered) ──────────────────────────────────────────

function LayoutViewport(): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
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
  // Mark bins that do not fit the print bed
  useBedMarks(engine, project?.gridfinity, tick)

  // Delete key for selected shapes
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!engine) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeItems(engine, engine.getSelectedIds())
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
      <HistoryPanel />
    </>
  )
}

// ─── Main Viewport ──────────────────────────────────────────────────────────

export default function Viewport(): React.JSX.Element {
  const { mode, activeTool } = useAppMode()
  const { project, bakeResults } = useProject()
  const engine = useLayoutEngine()
  // Here, not in the Design-only part below: the history has to outlive a visit to Preview.
  useEngineUndoRedo(engine)

  const baseUnit = project?.gridfinity.baseUnit ?? 42

  // The right-click menu belongs to the Select tool. A drawing tool keeps its own clicks.
  const canUseMenu = mode === 'layout' && (activeTool === 'select' || activeTool === null)
  // Where the last right-click on the canvas was, for the menu's "Add bin here".
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null)
  /** The menu acts on the selection, so a right-click first selects what is under it. */
  const selectUnderPointer = (e: React.MouseEvent): void => {
    if (!engine || !canUseMenu) return
    // The engine measures from the corner of the canvas, which this element covers.
    const canvas = e.currentTarget.getBoundingClientRect()
    const world = engine.screenToWorld(e.clientX - canvas.left, e.clientY - canvas.top)
    setMenuPoint(world)
    const hit = engine.objectAt(world.x, world.y)
    if (!hit) {
      engine.clearSelection()
      return
    }
    // A shape in a selected bin is part of that selection, though only the bin is listed.
    const selected = engine.getSelectedIds()
    const binId = hit.type === 'shape' ? engine.getShape(hit.id)?.groupId : null
    const isSelected = selected.includes(hit.id) || (binId != null && selected.includes(binId))
    if (!isSelected) engine.select([hit.id])
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Layout canvas always mounted so engine survives mode switches */}
      <EditContextMenu disabled={!canUseMenu} canvasPoint={menuPoint}>
        <div
          className={
            mode === 'layout' ? 'relative h-full' : 'absolute inset-0 invisible pointer-events-none'
          }
          onContextMenu={selectUnderPointer}
        >
          <LayoutEngineCanvas />
          {mode === 'layout' && <LayoutViewport />}
          {mode === 'layout' && <DrawingToolLayer />}
          {mode === 'layout' && <ShapeTooltip />}
        </div>
      </EditContextMenu>
      <div className={mode === 'review' ? 'h-full' : 'hidden'}>
        <ReviewCanvas bakeResults={bakeResults} baseUnit={baseUnit} />
      </div>
      <HintCard />
    </div>
  )
}
