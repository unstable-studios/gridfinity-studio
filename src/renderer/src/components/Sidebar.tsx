import { useMemo, useRef } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { GridPicker } from '@/components/ui/grid-picker'
import { shapeTypeLabel } from '@/lib/shape-labels'
import { selectionAfterClick } from '@/lib/list-selection'
import { NumericInput } from '@/components/ui/numeric-input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import ArrangeControls from './ArrangeControls'
import NameField from './NameField'
import EditContextMenu from './EditContextMenu'
import { useRenaming } from '@/hooks/useEditCommands'
import { storedName } from '@/lib/item-name'
import { removeItems } from '@/lib/remove-items'
import { arrangeTarget } from '@/layout-engine/arrange-target'
import {
  shownPositionLimits,
  toShownPosition,
  toStoredPosition
} from '@/layout-engine/position-frame'
import type { PositionFrame } from '@/layout-engine/position-frame'
import { usePositionFrame } from '@/hooks/usePositionFrame'
import { useProject } from '@/hooks/useProject'
import { useProjectName } from '@/hooks/useProjectName'
import { notifyResizeBlocked } from '@/lib/project-notices'
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
      className="absolute top-3 left-3 bottom-3 z-30 w-64 rounded-xl border border-zinc-300/60 bg-white/90 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/90 overflow-y-auto [scrollbar-gutter:stable]"
    >
      {mode === 'layout' ? <LayoutSidebar /> : <PreviewSidebar />}
    </aside>
  )
}

// ─── Layout Sidebar ─────────────────────────────────────────

/** A row while its name is being typed: the same size as the row it replaces. */
const RENAME_ROW_CLASS = 'px-2 py-1 text-xs'

/** A row in the bin or shape list. `select-none` keeps a Shift-click from selecting text. */
function listRowClass(isSelected: boolean): string {
  return `w-full select-none rounded px-2 py-1 text-left text-xs transition-colors ${
    isSelected
      ? 'bg-blue-600 text-white'
      : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
  }`
}

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

  // Clicking rows in the two lists selects as in a file manager. The lists count as one,
  // bins first, so a Shift-click can reach from a bin down into the shapes.
  const listAnchorRef = useRef<string | null>(null)
  const handleRowClick = (id: string, e: React.MouseEvent): void => {
    if (!engine) return
    const next = selectionAfterClick({
      order: [...binGroups.map((g) => g.id), ...shapes.map((sh) => sh.id)],
      selected: selectedIds,
      clicked: id,
      anchor: listAnchorRef.current,
      shift: e.shiftKey,
      toggle: e.metaKey || e.ctrlKey
    })
    listAnchorRef.current = next.anchor
    // A shape in a selected bin comes along with the bin. Selecting both would move it twice.
    const picked = new Set(next.selected)
    const inPickedBin = new Set(
      shapes.filter((sh) => sh.groupId !== null && picked.has(sh.groupId)).map((sh) => sh.id)
    )
    engine.select(next.selected.filter((selectedId) => !inPickedBin.has(selectedId)))
  }

  // The row being renamed in place, after a double-click.
  const renamingId = useRenaming((state) => state.id)
  const setRenamingId = (id: string | null): void => useRenaming.setState({ id })
  /** A right-click acts on the row under it: select that row unless it already is. */
  const selectForMenu = (id: string): void => {
    if (!selectedIds.includes(id)) engine?.select([id])
  }
  const renameGroup = (id: string, name: string): void => {
    const group = engine?.getGroup(id)
    if (group) engine?.updateGroup(id, { metadata: { ...group.metadata, name } })
  }
  const renameShape = (id: string, name: string): void => {
    const shape = engine?.getShape(id)
    if (shape) engine?.updateShape(id, { metadata: { ...shape.metadata, name } })
  }

  // Determine what's selected
  const selectedGroup = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return groups.find((g) => g.id === selectedIds[0]) ?? null
  }, [selectedIds, groups])

  const selectedShape = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return shapes.find((s) => s.id === selectedIds[0]) ?? null
  }, [selectedIds, shapes])

  // X and Y are shown on the canvas unless the person asks for them relative
  // to the bin. On the canvas the numbers keep their meaning when a shape
  // moves into or out of a bin.
  const positionFrame = usePositionFrame((s) => s.frame)
  const setPositionFrame = usePositionFrame((s) => s.setFrame)
  const selectedShapeBin = selectedShape
    ? groups.find((g) => g.id === selectedShape.groupId)
    : undefined
  // Shown with the origin at the lower left and Y increasing upward.
  const shownPosition = selectedShape
    ? toShownPosition(selectedShape, selectedShapeBin, positionFrame)
    : { x: 0, y: 0 }
  const positionLimits = selectedShape
    ? shownPositionLimits(selectedShape, selectedShapeBin, positionFrame)
    : null
  const editShownPosition = (shown: { x?: number; y?: number }): void => {
    if (!selectedShape) return
    editSelectedShapePosition(
      toStoredPosition(shown, selectedShape, selectedShapeBin, positionFrame)
    )
  }

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

    if (!engine.updateGroup(groupId, groupPatch)) notifyResizeBlocked()
  }

  const handleDeleteSelected = (): void => {
    if (engine) removeItems(engine, selectedIds)
  }

  return (
    <div className="space-y-4">
      <ProjectNameHeader />

      {/* Bin creation */}
      <SidebarSection title="Add bin">
        <GridPicker onChange={handleAddBin} />
      </SidebarSection>

      {/* Bin list */}
      {binGroups.length > 0 && (
        <SidebarSection title={`Bins (${binGroups.length})`}>
          <EditContextMenu>
            <div className="space-y-0.5">
              {binGroups.map((group) => {
                const meta = group.metadata as BinMetadata
                const isSelected = selectedIds.includes(group.id)
                if (renamingId === group.id) {
                  return (
                    <NameField
                      key={group.id}
                      autoFocus
                      aria-label="Bin name"
                      className={RENAME_ROW_CLASS}
                      value={storedName(meta) ?? 'Bin'}
                      onRename={(name) => renameGroup(group.id, name)}
                      onDone={() => setRenamingId(null)}
                    />
                  )
                }
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={listRowClass(isSelected)}
                    onClick={(e) => handleRowClick(group.id, e)}
                    onDoubleClick={() => setRenamingId(group.id)}
                    onContextMenu={() => selectForMenu(group.id)}
                  >
                    <span className="font-medium">{storedName(meta) ?? 'Bin'}</span>
                    <span className="ml-2 opacity-60">
                      {meta.widthUnits}×{meta.depthUnits} ({meta.heightUnits}u)
                    </span>
                  </button>
                )
              })}
            </div>
          </EditContextMenu>
        </SidebarSection>
      )}

      {/* Shape list */}
      {shapes.length > 0 && (
        <SidebarSection title={`Shapes (${shapes.length})`}>
          <EditContextMenu>
            <div className="space-y-0.5">
              {shapes.map((shape) => {
                const isSelected = selectedIds.includes(shape.id)
                if (renamingId === shape.id) {
                  return (
                    <NameField
                      key={shape.id}
                      autoFocus
                      aria-label="Shape name"
                      className={RENAME_ROW_CLASS}
                      value={storedName(shape.metadata) ?? shapeTypeLabel(shape.type)}
                      onRename={(name) => renameShape(shape.id, name)}
                      onDone={() => setRenamingId(null)}
                    />
                  )
                }
                return (
                  <button
                    key={shape.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={listRowClass(isSelected)}
                    onClick={(e) => handleRowClick(shape.id, e)}
                    onDoubleClick={() => setRenamingId(shape.id)}
                    onContextMenu={() => selectForMenu(shape.id)}
                  >
                    <span className="font-medium">
                      {storedName(shape.metadata) ?? shapeTypeLabel(shape.type)}
                    </span>
                    <span className="ml-2 opacity-60">{shapeTypeLabel(shape.type)}</span>
                  </button>
                )
              })}
            </div>
          </EditContextMenu>
        </SidebarSection>
      )}

      {/* Selected bin properties */}
      {selectedGroup && isBinGroup(selectedGroup) && (
        <SidebarSection title="Bin properties">
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Name</span>
              <NameField
                // A field per bin: text typed for one bin can never be applied to another.
                key={selectedGroup.id}
                aria-label="Bin name"
                className="px-2 py-1 text-xs"
                value={storedName(selectedGroup.metadata) ?? 'Bin'}
                onRename={(name) => renameGroup(selectedGroup.id, name)}
              />
            </label>
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
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">Name</span>
              <NameField
                key={selectedShape.id}
                aria-label="Shape name"
                className="px-2 py-1 text-xs"
                value={storedName(selectedShape.metadata) ?? shapeTypeLabel(selectedShape.type)}
                onRename={(name) => renameShape(selectedShape.id, name)}
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Type</span>
              <span className="text-zinc-300">{shapeTypeLabel(selectedShape.type)}</span>
            </div>
            {selectedShape.groupId && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Relative to</span>
                <ToggleGroup
                  type="single"
                  aria-label="Relative to"
                  value={positionFrame}
                  onValueChange={(value) => {
                    if (value) setPositionFrame(value as PositionFrame)
                  }}
                >
                  <ToggleGroupItem value="canvas" className="px-2 py-0.5">
                    Canvas
                  </ToggleGroupItem>
                  <ToggleGroupItem value="bin" className="px-2 py-0.5">
                    Bin
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
            <NumericInput
              label="X"
              value={shownPosition.x}
              step={1}
              precision={1}
              min={positionLimits?.min.x}
              max={positionLimits?.max.x}
              onChange={(v) => editShownPosition({ x: v })}
              onCommit={commitPositionEdit}
            />
            <NumericInput
              label="Y"
              value={shownPosition.y}
              step={1}
              precision={1}
              min={positionLimits?.min.y}
              max={positionLimits?.max.y}
              onChange={(v) => editShownPosition({ y: v })}
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
  const projectName = useProjectName()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bins = useMemo(() => (engine?.getAllGroups() ?? []).filter(isBinGroup), [engine, tick])

  const totalBins = bins.length
  // Export only when every bin has finished its latest bake successfully — no
  // partial / stale / errored exports.
  const allReady = totalBins > 0 && bins.every((b) => bakeStatus.get(b.id) === 'ready')
  const anyError = bins.some((b) => bakeStatus.get(b.id) === 'error')
  const warnings = useMemo(
    () => [...bakeResults.values()].flatMap((r) => r.warnings),
    [bakeResults]
  )

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
                      {storedName(meta) ?? 'Bin'}
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

      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-amber-500">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
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
  const name = useProjectName()

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
          <span>Leaves a thin floor. Max {maxSafe.toFixed(1)} mm.</span>
        </div>
      )}
    </div>
  )
}
