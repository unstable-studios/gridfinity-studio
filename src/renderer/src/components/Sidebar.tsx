import { useMemo } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { GridPicker } from '@/components/ui/grid-picker'
import { NumericInput } from '@/components/ui/numeric-input'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import { useLayoutEngine, useEngineState, isBinGroup } from '@/layout-engine'
import type { BinMetadata, LayoutGroup } from '@/layout-engine'

export default function Sidebar(): React.JSX.Element {
  const { mode } = useAppMode()

  return (
    <aside className="absolute top-3 left-3 bottom-3 z-30 w-64 rounded-xl border border-zinc-300/60 bg-white/90 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-zinc-700/60 dark:bg-zinc-900/90 overflow-y-auto">
      {mode === 'layout' ? (
        <LayoutSidebar />
      ) : (
        <div className="text-xs text-zinc-500">Preview mode — coming soon.</div>
      )}
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

  const handleAddBin = (widthUnits: number, depthUnits: number): void => {
    if (!engine) return
    const id = crypto.randomUUID()
    const width = widthUnits * baseUnit
    const height = depthUnits * baseUnit
    const existingCount = binGroups.length

    // Place in upper-right quadrant (positive X, negative Y in canvas coords)
    // Stack bins horizontally with spacing to avoid overlap
    const x = width / 2 + existingCount * baseUnit * 3
    const y = -(height / 2)

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

    // If width/depth units changed, resize the group
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
      <SidebarSection title="Add Bin">
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
        <SidebarSection title="Bin Properties">
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
        <SidebarSection title="Shape Properties">
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
              onChange={(v) => engine?.updateShape(selectedShape.id, { x: v })}
            />
            <NumericInput
              label="Y"
              value={selectedShape.y}
              step={1}
              precision={1}
              onChange={(v) => engine?.updateShape(selectedShape.id, { y: v })}
            />
          </div>
        </SidebarSection>
      )}

      {/* Delete button */}
      {selectedIds.length > 0 && (
        <Button
          variant="outline"
          className="w-full text-red-500 border-red-500/30 hover:bg-red-500/10"
          onClick={handleDeleteSelected}
        >
          Delete Selected
        </Button>
      )}
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
    : 'Untitled Project'

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
