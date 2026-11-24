import { useMemo, useRef } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { GridPicker } from '@/components/ui/grid-picker'
import { NumericInput } from '@/components/ui/numeric-input'
import ArrangeControls from './ArrangeControls'
import { arrangeTarget } from '@/layout-engine/arrange-target'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import {
  useLayoutEngine,
  useLayoutEngineContext,
  useEngineState,
  isBinGroup
} from '@/layout-engine'
import type { BinMetadata, LayoutGroup, LayoutShape, LayoutEngine } from '@/layout-engine'
import { buildSTLArrayBuffer, build3MFArrayBuffer, placementsFromGroups } from '@/lib/export-baked'
import { computeDefaultPocketDepth, DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'

/** Depth threshold (mm) below the bin's max safe depth at which we warn. */
const DEPTH_WARN_MARGIN = 2

export default function Sidebar(): React.JSX.Element {
  const { mode } = useAppMode()
  const { sidebarRef } = useLayoutEngineContext()

  return (
    <aside
      ref={sidebarRef}
      className="absolute top-3 left-3 bottom-3 z-30 w-64 rounded-xl border border-zinc-300/60 bg-white/90 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/90 overflow-y-auto"
    >
      {mode === 'layout' ? <LayoutSidebar /> : <PreviewSidebar />}
    </aside>
  )
}

// ─── Layout Sidebar ─────────────────────────────────────────

function LayoutSidebar(): React.JSX.Element {
  const engine = useLayoutEngine()
  const { selectedIds, tick } = useEngineState()
  const project = useProject((s) => s.project)
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  // Re-read engine data on any mutation (tick) or selection change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => engine?.getAllGroups() ?? [], [engine, selectedIds, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shapes = useMemo(() => engine?.getAllShapes() ?? [], [engine, selectedIds, tick])
  const binGroups = useMemo(() => groups.filter(isBinGroup), [groups])

  // Determine what's selected
  const selectedGroup = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return groups.find((g) => g.id === selectedIds[0]) ?? null
  }, [selectedIds, groups])

  const selectedShape = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return shapes.find((s) => s.id === selectedIds[0]) ?? null
  }, [selectedIds, shapes])

  // Editing a shape's X or Y. Each step moves the shape for live feedback.
  // When the adjustment is finished the whole move is replayed as one change,
  // so it is a single undo step and the shape changes bin at most once, at
  // the end. A shape's position is relative to its bin, so changing bin
  // part-way through would change what the numbers mean.
  const positionEditRef = useRef<{ id: string; x: number; y: number } | null>(null)

  const commitPositionEdit = (): void => {
    const start = positionEditRef.current
    positionEditRef.current = null
    const current = start && engine?.getShape(start.id)
    if (!engine || !start || !current) return
    const dx = current.x - start.x
    const dy = current.y - start.y
    if (dx === 0 && dy === 0) return
    engine.batch(() => {
      engine.updateShape(start.id, { x: start.x, y: start.y }, { transient: true })
      engine.translateShapes([{ id: start.id, dx, dy }])
    })
  }

  const editSelectedShapePosition = (to: { x?: number; y?: number }): void => {
    if (!engine || !selectedShape) return
    if (positionEditRef.current && positionEditRef.current.id !== selectedShape.id) {
      commitPositionEdit()
    }
    if (!positionEditRef.current) {
      const current = engine.getShape(selectedShape.id)
      if (!current) return
      positionEditRef.current = { id: current.id, x: current.x, y: current.y }
    }
    engine.updateShape(selectedShape.id, to, { transient: true })
  }

  // Which arrange buttons to offer. Follows shapes and groups so it is not
  // measured again on every pan and zoom.
  const arrange = useMemo(
    () => (engine ? arrangeTarget(engine, selectedIds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, selectedIds, shapes, groups]
  )

  const handleAddBin = (widthUnits: number, depthUnits: number): void => {
    if (!engine) return
    const id = crypto.randomUUID()
    const width = widthUnits * baseUnit
    const height = depthUnits * baseUnit
    const existingCount = binGroups.length

    // Place new bin to the right of the rightmost existing bin (with one grid unit gap).
    // x,y = lower-left corner: left edge at x, bottom edge at y.
    const rightEdge = binGroups.reduce((max, g) => Math.max(max, g.x + g.width), 0)
    const x = binGroups.length === 0 ? 0 : rightEdge + baseUnit
    const y = 0

    const metadata: BinMetadata = {
      widthUnits,
      depthUnits,
      heightUnits: 3,
      hasLip: true,
      name: `Bin ${existingCount + 1}`
    }

    engine.createGroup({
      id,
      x,
      y,
      width,
      height,
      rotation: 0,
      childIds: [],
      style: {
        fill: 'rgba(96, 165, 250, 0.05)',
        stroke: '#60a5fa',
        strokeWidth: 1,
        cornerRadius: 4
      },
      metadata
    })

    engine.select([id])
  }

  const handleUpdateBinMetadata = (groupId: string, patch: Partial<BinMetadata>): void => {
    if (!engine) return
    const group = engine.getGroup(groupId)
    if (!group || !isBinGroup(group)) return

    const updated: BinMetadata = { ...group.metadata, ...patch }
    const groupPatch: Partial<LayoutGroup> = { metadata: updated }

    // If width/depth units changed, just update dimensions.
    // x,y is the lower-left corner, so it stays fixed — bin grows rightward and upward.
    if (patch.widthUnits !== undefined || patch.depthUnits !== undefined) {
      groupPatch.width = updated.widthUnits * baseUnit
      groupPatch.height = updated.depthUnits * baseUnit
    }

    engine.updateGroup(groupId, groupPatch)
  }

  const handleDeleteSelected = (): void => {
    if (!engine || selectedIds.length === 0) return
    engine.clearSelection()
    for (const id of selectedIds) {
      const group = engine.getGroup(id)
      if (group) {
        engine.removeGroup(id)
      } else {
        engine.removeShape(id)
      }
    }
  }

  return (
    <div className="space-y-4">
      <ProjectNameHeader />

      {/* Bin creation */}
      <SidebarSection title="Add bin">
        <GridPicker width={1} depth={1} onChange={handleAddBin} />
      </SidebarSection>

      {/* Bin list */}
      {binGroups.length > 0 && (
        <SidebarSection title={`Bins (${binGroups.length})`}>
          <div className="space-y-0.5">
            {binGroups.map((group) => {
              const meta = group.metadata as BinMetadata
              const isSelected = selectedIds.includes(group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                  onClick={() => engine?.select([group.id])}
                >
                  <span className="font-medium">{meta.name ?? group.id}</span>
                  <span className="ml-2 opacity-60">
                    {meta.widthUnits}x{meta.depthUnits} ({meta.heightUnits}u)
                  </span>
                </button>
              )
            })}
          </div>
        </SidebarSection>
      )}

      {/* Shape list */}
      {shapes.length > 0 && (
        <SidebarSection title={`Shapes (${shapes.length})`}>
          <div className="space-y-0.5">
            {shapes.map((shape) => {
              const isSelected = selectedIds.includes(shape.id)
              return (
                <button
                  key={shape.id}
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                  onClick={() => engine?.select([shape.id])}
                >
                  <span className="font-medium">
                    {(shape.metadata?.name as string) ?? shape.id}
                  </span>
                  <span className="ml-2 opacity-60">{shape.type}</span>
                </button>
              )
            })}
          </div>
        </SidebarSection>
      )}

      {/* Selected bin properties */}
      {selectedGroup && isBinGroup(selectedGroup) && (
        <SidebarSection title="Bin properties">
          <div className="space-y-2 text-xs">
            <GridPicker
              width={selectedGroup.metadata.widthUnits}
              depth={selectedGroup.metadata.depthUnits}
              onChange={(w, d) =>
                handleUpdateBinMetadata(selectedGroup.id, { widthUnits: w, depthUnits: d })
              }
            />
            <div className="grid grid-cols-3 gap-1">
              <NumericInput
                label="W"
                value={selectedGroup.metadata.widthUnits}
                suffix="u"
                step={1}
                min={1}
                precision={0}
                onChange={(v) => handleUpdateBinMetadata(selectedGroup.id, { widthUnits: v })}
              />
              <NumericInput
                label="D"
                value={selectedGroup.metadata.depthUnits}
                suffix="u"
                step={1}
                min={1}
                precision={0}
                onChange={(v) => handleUpdateBinMetadata(selectedGroup.id, { depthUnits: v })}
              />
              <NumericInput
                label="H"
                value={selectedGroup.metadata.heightUnits}
                suffix="u"
                step={1}
                min={1}
                precision={0}
                onChange={(v) => handleUpdateBinMetadata(selectedGroup.id, { heightUnits: v })}
              />
            </div>
            <label className="flex items-center justify-between">
              <span className="text-zinc-400">Stacking lip</span>
              <Switch
                checked={selectedGroup.metadata.hasLip}
                onCheckedChange={(v) =>
                  handleUpdateBinMetadata(selectedGroup.id, { hasLip: v === true })
                }
              />
            </label>
          </div>
        </SidebarSection>
      )}

      {/* Selected shape properties */}
      {selectedShape && (
        <SidebarSection title="Shape properties">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Type</span>
              <span className="text-zinc-300 font-mono">{selectedShape.type}</span>
            </div>
            <NumericInput
              label="X"
              value={selectedShape.x}
              step={1}
              precision={1}
              onChange={(v) => editSelectedShapePosition({ x: v })}
              onCommit={commitPositionEdit}
            />
            <NumericInput
              label="Y"
              value={selectedShape.y}
              step={1}
              precision={1}
              onChange={(v) => editSelectedShapePosition({ y: v })}
              onCommit={commitPositionEdit}
            />
            {engine && <ShapeDepthField shape={selectedShape} engine={engine} />}
          </div>
        </SidebarSection>
      )}

      {engine && arrange && (
        <SidebarSection title="Arrange">
          <ArrangeControls engine={engine} selectedIds={selectedIds} target={arrange} />
        </SidebarSection>
      )}

      {/* Delete button */}
      {selectedIds.length > 0 && (
        <Button
          variant="outline"
          className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10"
          onClick={handleDeleteSelected}
        >
          Delete selected
        </Button>
      )}
    </div>
  )
}

// ─── Preview Sidebar ────────────────────────────────────────

function PreviewSidebar(): React.JSX.Element {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const bakeResults = useProject((s) => s.bakeResults)
  const bakeStatus = useProject((s) => s.bakeStatus)
  const exportSTL = useProject((s) => s.exportSTL)
  const export3MF = useProject((s) => s.export3MF)
  const filePath = useProject((s) => s.filePath)
  const projectName = useMemo(() => {
    if (!filePath) return 'Untitled project'
    return (
      filePath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.gfstudio$/i, '') ?? 'Untitled project'
    )
  }, [filePath])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bins = useMemo(() => (engine?.getAllGroups() ?? []).filter(isBinGroup), [engine, tick])

  const totalBins = bins.length
  // Export only when every bin has finished its latest bake successfully — no
  // partial / stale / errored exports.
  const allReady = totalBins > 0 && bins.every((b) => bakeStatus.get(b.id) === 'ready')
  const anyError = bins.some((b) => bakeStatus.get(b.id) === 'error')
  const totalWarnings = useMemo(() => {
    let n = 0
    for (const r of bakeResults.values()) n += r.warnings.length
    return n
  }, [bakeResults])

  const handleExportSTL = async (): Promise<void> => {
    const placements = placementsFromGroups(bins)
    const data = await buildSTLArrayBuffer(bakeResults, placements)
    if (data) await exportSTL(data, `${projectName}.stl`)
  }
  const handleExport3MF = async (): Promise<void> => {
    const placements = placementsFromGroups(bins)
    const data = await build3MFArrayBuffer(bakeResults, projectName, placements)
    if (data) await export3MF(data, `${projectName}.3mf`)
  }

  return (
    <div className="space-y-4">
      <ProjectNameHeader />

      <SidebarSection title={`Bins (${totalBins})`}>
        {totalBins === 0 ? (
          <p className="text-xs text-zinc-500">No bins yet. Add one in Design.</p>
        ) : (
          <div className="space-y-1">
            {bins.map((bin) => {
              const status = bakeStatus.get(bin.id) ?? 'baking'
              const meta = bin.metadata as BinMetadata
              const pip =
                status === 'ready'
                  ? { className: 'text-[10px] text-emerald-500', label: '● Ready' }
                  : status === 'error'
                    ? { className: 'text-[10px] text-red-500', label: '⚠ Failed' }
                    : {
                        className: 'text-[10px] text-amber-500 animate-pulse',
                        label: '◌ Building…'
                      }
              return (
                <div
                  key={bin.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-zinc-100/60 dark:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-zinc-800 dark:text-zinc-200">
                      {meta.name ?? 'Bin'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {meta.widthUnits}×{meta.depthUnits} ({meta.heightUnits}u)
                    </p>
                  </div>
                  <span className={pip.className}>{pip.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </SidebarSection>

      {anyError && (
        <p className="text-[10px] text-red-500">
          Couldn’t build one or more bins. Edit them in Design to try again.
        </p>
      )}

      {totalWarnings > 0 && (
        <p className="text-[10px] text-amber-500">
          {totalWarnings} warning{totalWarnings === 1 ? '' : 's'} — see console
        </p>
      )}

      <SidebarSection title="Export">
        <div className="space-y-2">
          <Button
            variant="default"
            className="w-full"
            disabled={!allReady}
            onClick={() => void handleExport3MF()}
          >
            Export 3MF…
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!allReady}
            onClick={() => void handleExportSTL()}
          >
            Export STL…
          </Button>
          {!allReady && !anyError && totalBins > 0 && (
            <p className="text-[10px] text-zinc-500">Building the model…</p>
          )}
        </div>
      </SidebarSection>
    </div>
  )
}

// ─── Shared components ──────────────────────────────────────

function ProjectNameHeader(): React.JSX.Element {
  const filePath = useProject((s) => s.filePath)
  const name = filePath
    ? filePath
        .split(/[\\/]/)
        .pop()!
        .replace(/\.gfstudio$/, '')
    : 'Untitled project'

  return (
    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 truncate">{name}</p>
  )
}

function SidebarSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── Shape depth field ──────────────────────────────────────

/**
 * Per-shape pocket depth control. Auto-toggle defaults to the bin's
 * computed default (interior cavity height); switching off lets the user
 * override with a specific value, capped at the safe maximum and warning
 * when within DEPTH_WARN_MARGIN of that maximum.
 *
 * Hidden when the shape isn't grouped to a bin — depth has no meaning for
 * top-level shapes that don't get baked.
 */
function ShapeDepthField({
  shape,
  engine
}: {
  shape: LayoutShape
  engine: LayoutEngine
}): React.JSX.Element | null {
  const project = useProject((s) => s.project)
  const config = project?.gridfinity ?? DEFAULT_GRIDFINITY_CONFIG
  const adjustingRef = useRef<{ id: string; before: string } | null>(null)

  if (!shape.groupId) return null
  const bin = engine.getGroup(shape.groupId)
  if (!bin || !isBinGroup(bin)) return null

  const maxSafe = computeDefaultPocketDepth(bin.metadata.heightUnits, config.unitHeight)
  const meta = (shape.metadata ?? {}) as Record<string, unknown>
  const pocket = (meta.pocket as { depth?: number | null; clearance?: number } | undefined) ?? {}
  const isAuto = pocket.depth === undefined || pocket.depth === null
  const effectiveDepth = isAuto ? maxSafe : pocket.depth!
  const nearMax = !isAuto && effectiveDepth >= maxSafe - DEPTH_WARN_MARGIN

  const writeDepth = (next: number | null, options?: { transient?: boolean }): void => {
    const nextMeta = {
      ...meta,
      pocket: {
        clearance: pocket.clearance ?? 0.25,
        ...(next === null ? {} : { depth: next })
      }
    }
    engine.updateShape(shape.id, { metadata: nextMeta }, options)
  }

  // Each step of a depth adjustment is shown live. The adjustment is
  // recorded once, when it ends, so it is a single undo step.
  const adjustDepth = (next: number): void => {
    adjustingRef.current ??= { id: shape.id, before: JSON.stringify(shape.metadata) }
    writeDepth(next, { transient: true })
  }
  const commitDepth = (): void => {
    const start = adjustingRef.current
    adjustingRef.current = null
    const current = start && engine.getShape(start.id)
    // Ending where it began is not a change.
    if (!start || !current || JSON.stringify(current.metadata) === start.before) return
    engine.updateShape(current.id, { metadata: current.metadata })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">Depth</span>
        <label className="flex items-center gap-1 text-zinc-500 cursor-pointer">
          <span>Auto</span>
          <Switch
            checked={isAuto}
            onCheckedChange={(checked) => writeDepth(checked ? null : maxSafe)}
          />
        </label>
      </div>
      {!isAuto && (
        <NumericInput
          label="mm"
          value={effectiveDepth}
          step={0.5}
          fineStep={0.1}
          precision={1}
          min={0.1}
          max={maxSafe}
          onChange={adjustDepth}
          onCommit={commitDepth}
        />
      )}
      {nearMax && (
        <div className="flex items-start gap-1 text-amber-600 dark:text-amber-400 text-[10px] leading-tight">
          <span aria-hidden="true">⚠</span>
          <span>
            Close to the bin floor. The print may be fragile. Max {maxSafe.toFixed(1)} mm.
          </span>
        </div>
      )}
    </div>
  )
}
