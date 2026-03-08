import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { GridPicker } from '@/components/ui/grid-picker'
import { NumericInput } from '@/components/ui/numeric-input'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import { useReviewPrefs } from '@/hooks/useReviewPrefs'
import { useLayoutEngine, useEngineState, isBinGroup } from '@/layout-engine'
import type { BinMetadata, LayoutGroup } from '@/layout-engine'
import { exportSTL as createSTLBlob } from '@/lib/stl-io'
import { export3MF as create3MFBlob } from '@/lib/threemf-writer'
import { meshDataToBufferGeometry } from '@/lib/mesh-convert'
import { entityToVertices } from '@/lib/entity-shapes'
import { hasBinOverlaps } from '@/lib/collision'
import { useGeometryWorker } from '@/hooks/useGeometryWorker'
import type { PocketSpec, CSGBinParams } from '../../../shared/types/worker'
import type { Bin } from '../../../shared/types/project'

export default function Sidebar(): React.JSX.Element {
  const { mode } = useAppMode()
  const { project, clearAllBakeResults } = useProject()
  const bins = useMemo(() => project?.bins ?? [], [project?.bins])
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  // Clear stale bake results when all bins are removed
  useEffect(() => {
    if (bins.length === 0) clearAllBakeResults()
  }, [bins.length, clearAllBakeResults])

  // Detect bin-to-bin overlap (e.g. from loaded projects with bad data)
  const binsOverlap = useMemo(() => {
    if (bins.length < 2) return false
    return hasBinOverlaps(
      bins.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        w: b.width * baseUnit,
        d: b.depth * baseUnit
      }))
    )
  }, [bins, baseUnit])

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-zinc-300/80 bg-white/80 px-4 py-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 overflow-y-auto">
      {!binsOverlap && bins.map((bin) => <BinBaker key={bin.id} bin={bin} />)}
      {mode === 'layout' ? <LayoutSidebar /> : <ReviewSidebar binsOverlap={binsOverlap} />}
    </aside>
  )
}

// ─── Layout Sidebar ─────────────────────────────────────────

function LayoutSidebar(): React.JSX.Element {
  const engine = useLayoutEngine()
  const { selectedIds } = useEngineState()
  const project = useProject((s) => s.project)
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  // Get groups and shapes from engine
  const groups = useMemo(() => engine?.getAllGroups() ?? [], [engine, selectedIds])
  const shapes = useMemo(() => engine?.getAllShapes() ?? [], [engine, selectedIds])
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

    // Place at origin offset by bin count to avoid overlap
    const x = width / 2 + existingCount * baseUnit
    const y = height / 2

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

// ─── BinBaker (headless, triggers CSG worker on bin/entity changes) ──

function BinBaker({ bin }: { bin: Bin }): null {
  const { setBakeResult, project } = useProject()
  const { ready, bakePockets } = useGeometryWorker()

  const entities = project?.entities ?? []
  const gridfinity = project?.gridfinity

  // Stable serialization of pocket entities to avoid re-triggering on every render
  const pocketEntities = entities.filter(
    (e) => bin.entityIds.includes(e.id) && e.pocket && e.pocket.depth > 0
  )
  const pocketKey = JSON.stringify(
    pocketEntities.map((e) => ({
      id: e.id,
      type: e.type,
      pocket: e.pocket,
      pos: e.transform.position,
      ...(e.type === 'circle' ? { diameter: e.diameter } : {}),
      ...(e.type === 'rectangle' ? { width: e.width, height: e.height } : {}),
      ...(e.type === 'polygon' ? { vertices: e.vertices } : {})
    }))
  )

  const bakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bakeSeq = useRef(0)

  useEffect(() => {
    if (!gridfinity || !ready) return

    // Cancel any pending debounced bake
    if (bakeTimer.current) clearTimeout(bakeTimer.current)

    // Bump sequence so in-flight results from stale requests are ignored
    const seq = ++bakeSeq.current

    bakeTimer.current = setTimeout(() => {
      const gridCfg = gridfinity

      // Bin center in canvas world coordinates — entity positions are absolute,
      // but the bin mesh is centered at origin, so we subtract the bin center.
      const binCenterX = bin.position.x + (bin.width * gridCfg.baseUnit) / 2
      const binCenterY = bin.position.y + (bin.depth * gridCfg.baseUnit) / 2

      const totalH = bin.height * gridCfg.unitHeight

      // Convert pocket entities to PocketSpec for the CSG worker
      const pockets: PocketSpec[] = []
      for (const entity of pocketEntities) {
        if (!entity.pocket || entity.pocket.depth <= 0) continue
        const entityVerts = entityToVertices(entity)
        if (!entityVerts) continue

        const posX = entity.transform.position.x - binCenterX
        const posY = entity.transform.position.y - binCenterY

        pockets.push({
          vertices: entityVerts,
          depth: entity.pocket.depth,
          clearance: entity.pocket.clearance,
          posX,
          posY,
          zTop: totalH // cut downward from the top surface of the solid block
        })
      }

      const binParams: CSGBinParams = {
        widthUnits: bin.width,
        depthUnits: bin.depth,
        heightUnits: bin.height,
        baseUnit: gridCfg.baseUnit,
        unitHeight: gridCfg.unitHeight,
        tolerance: gridCfg.tolerance,
        hasLip: bin.hasStackingLip,
        magnetHoles: gridCfg.magnetHoles,
        screwHoles: gridCfg.screwHoles,
        pockets
      }

      void bakePockets(binParams).then((result) => {
        // Ignore results from stale bake requests
        if (bakeSeq.current !== seq) return
        setBakeResult(bin.id, {
          mesh: {
            positions: result.positions,
            colors: result.colors,
            indices: result.indices,
            normals: result.normals
          },
          timestamp: Date.now(),
          warnings: result.warnings
        })
      })
    }, 300)

    return () => {
      if (bakeTimer.current) clearTimeout(bakeTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pocketKey is a stable serialization of pocketEntities
  }, [
    gridfinity,
    ready,
    bakePockets,
    setBakeResult,
    bin.id,
    bin.width,
    bin.depth,
    bin.height,
    bin.hasStackingLip,
    bin.position.x,
    bin.position.y,
    pocketKey
  ])

  return null
}

// ─── Review Sidebar ─────────────────────────────────────────

function ReviewSidebar({ binsOverlap }: { binsOverlap: boolean }): React.JSX.Element {
  const {
    project,
    bakeResults,
    exportSTL: doExport,
    export3MF: doExport3MF,
    exportBatch
  } = useProject()
  const { debugColors, setDebugColors, wireframe, setWireframe } = useReviewPrefs()
  const [exporting, setExporting] = useState(false)

  const bins = useMemo(() => project?.bins ?? [], [project?.bins])
  const bakedCount = bakeResults.size
  const totalBins = bins.length
  const allWarnings = [...bakeResults.values()].flatMap((r) => r.warnings)

  const handleExportSingle = useCallback(async () => {
    if (bakeResults.size === 0) return
    const first = [...bakeResults.values()][0]
    setExporting(true)
    try {
      const geometry = meshDataToBufferGeometry(first.mesh)
      const blob = createSTLBlob(geometry)
      const buffer = await blob.arrayBuffer()
      await doExport(buffer)
    } finally {
      setExporting(false)
    }
  }, [bakeResults, doExport])

  const handleExport3MF = useCallback(async () => {
    if (bakeResults.size === 0) return
    const first = [...bakeResults.values()][0]
    setExporting(true)
    try {
      const geometry = meshDataToBufferGeometry(first.mesh)
      const blob = await create3MFBlob(geometry, bins[0]?.name ?? 'model')
      const buffer = await blob.arrayBuffer()
      await doExport3MF(buffer)
    } finally {
      setExporting(false)
    }
  }, [bakeResults, bins, doExport3MF])

  const handleExportAll = useCallback(async () => {
    if (bakeResults.size === 0) return
    setExporting(true)
    try {
      const files: Array<{ filename: string; data: ArrayBuffer }> = []
      for (const bin of bins) {
        const result = bakeResults.get(bin.id)
        if (!result) continue
        const geometry = meshDataToBufferGeometry(result.mesh)
        const blob = createSTLBlob(geometry)
        const buffer = await blob.arrayBuffer()
        const safeName = bin.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        files.push({ filename: `${safeName}.stl`, data: buffer })
      }
      if (files.length > 0) await exportBatch(files)
    } finally {
      setExporting(false)
    }
  }, [bakeResults, bins, exportBatch])

  return (
    <div className="space-y-4">
      {binsOverlap && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          Bins overlap — resolve positions in Layout mode before exporting.
        </div>
      )}
      <SidebarSection title="Status">
        {binsOverlap ? (
          <p className="text-xs text-red-400">Baking paused — bins overlap.</p>
        ) : bakedCount > 0 ? (
          <p className="text-xs text-green-500">
            {bakedCount === 1 ? 'Model ready' : `${bakedCount}/${totalBins} bins ready`}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">Add a bin to generate a model.</p>
        )}
        {allWarnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-500">
            {w}
          </p>
        ))}
      </SidebarSection>

      <SidebarSection title="Display">
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Debug colors</span>
            <Switch checked={debugColors} onCheckedChange={setDebugColors} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Wireframe</span>
            <Switch checked={wireframe} onCheckedChange={setWireframe} />
          </label>
        </div>
      </SidebarSection>

      <SidebarSection title="Export">
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              className="flex-1"
              disabled={bakedCount === 0 || exporting || binsOverlap}
              onClick={() => void handleExportSingle()}
            >
              {exporting ? '...' : 'STL'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={bakedCount === 0 || exporting || binsOverlap}
              onClick={() => void handleExport3MF()}
            >
              {exporting ? '...' : '3MF'}
            </Button>
          </div>
          {totalBins > 1 && (
            <Button
              variant="outline"
              className="w-full"
              disabled={bakedCount === 0 || exporting || binsOverlap}
              onClick={() => void handleExportAll()}
            >
              {exporting ? 'Exporting...' : `Export All (${bakedCount} bins)`}
            </Button>
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
