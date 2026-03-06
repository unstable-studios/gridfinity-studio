import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@unstable-studios/ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Switch } from '@/components/ui/switch'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import { useSharedSelection } from '@/hooks/useSelection'
import { useReviewPrefs } from '@/hooks/useReviewPrefs'

import { exportSTL as createSTLBlob } from '@/lib/stl-io'
import { export3MF as create3MFBlob } from '@/lib/threemf-writer'
import { meshDataToBufferGeometry } from '@/lib/mesh-convert'
import { entityToVertices } from '@/lib/entity-shapes'
import { autoWrap } from '@/lib/auto-wrap'
import { binOverlapsAny, findNonOverlappingPosition, hasBinOverlaps } from '@/lib/collision'
import { useGeometryWorker } from '@/hooks/useGeometryWorker'
import type { PocketSpec, CSGBinParams } from '../../../shared/types/worker'
import type { Entity, Bin, PocketConfig } from '../../../shared/types/project'
import { computeDefaultPocketDepth } from '../../../shared/types/project'

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
      {mode === 'layout' ? (
        <LayoutSidebar entities={project?.entities ?? []} binsOverlap={binsOverlap} />
      ) : (
        <ReviewSidebar binsOverlap={binsOverlap} />
      )}
    </aside>
  )
}

function LayoutSidebar({
  entities,
  binsOverlap
}: {
  entities: Entity[]
  binsOverlap: boolean
}): React.JSX.Element {
  const { project, updateEntity, removeEntity, addBin, updateBin, removeBin } = useProject()
  const selection = useSharedSelection()
  const { selectedIds, selectionType, select, selectBin } = selection

  const bins = useMemo(() => project?.bins ?? [], [project?.bins])
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  // Build entity lookup and assignment sets
  const assignedEntityIds = useMemo(() => {
    const ids = new Set<string>()
    for (const bin of bins) {
      for (const eid of bin.entityIds) ids.add(eid)
    }
    return ids
  }, [bins])

  const unassignedEntities = useMemo(
    () => entities.filter((e) => !assignedEntityIds.has(e.id)),
    [entities, assignedEntityIds]
  )

  const selectedEntity =
    selectionType === 'entity' && selectedIds.size > 0
      ? (entities.find((e) => selectedIds.has(e.id)) ?? null)
      : null

  const selectedBin =
    selectionType === 'bin' && selectedIds.size > 0
      ? (bins.find((b) => selectedIds.has(b.id)) ?? null)
      : null

  const otherBinRects = useCallback(
    (excludeId?: string) =>
      bins
        .filter((b) => b.id !== excludeId)
        .map((b) => ({
          x: b.position.x,
          y: b.position.y,
          w: b.width * baseUnit,
          d: b.depth * baseUnit
        })),
    [bins, baseUnit]
  )

  const handleAddBin = (): void => {
    const w = 1 * baseUnit
    const d = 1 * baseUnit
    const existing = otherBinRects()
    const pos = findNonOverlappingPosition(w, d, baseUnit, existing)
    const bin = addBin({ position: pos })
    selectBin(bin.id)
  }

  const handleAutoWrap = (): void => {
    if (unassignedEntities.length === 0) return
    const result = autoWrap(unassignedEntities, baseUnit)
    const w = result.width * baseUnit
    const d = result.depth * baseUnit
    const existing = otherBinRects()

    // If the auto-wrap position overlaps, find the next free spot
    let pos = result.position
    if (binOverlapsAny({ x: pos.x, y: pos.y, w, d }, existing)) {
      pos = findNonOverlappingPosition(w, d, baseUnit, existing, pos.x, pos.y)
    }

    const heightUnits = 3
    const unitHeight = project?.gridfinity.unitHeight ?? 7
    const defaultDepth = computeDefaultPocketDepth(heightUnits, unitHeight)

    // Assign default pockets to entities that don't already have one
    for (const entity of unassignedEntities) {
      if (!entity.pocket) {
        updateEntity(entity.id, { pocket: { depth: defaultDepth, clearance: 0.2 } })
      }
    }

    const bin = addBin({
      width: result.width,
      depth: result.depth,
      height: heightUnits,
      position: pos,
      entityIds: unassignedEntities.map((e) => e.id)
    })
    selectBin(bin.id)
  }

  const handleBinUpdate = (binId: string, patch: Partial<Bin>): void => {
    const bin = bins.find((b) => b.id === binId)
    if (!bin) return

    // If width or depth changed, check for overlap at the new size
    const newWidth = patch.width ?? bin.width
    const newDepth = patch.depth ?? bin.depth
    if (newWidth !== bin.width || newDepth !== bin.depth) {
      const candidate = {
        x: bin.position.x,
        y: bin.position.y,
        w: newWidth * baseUnit,
        d: newDepth * baseUnit
      }
      const others = otherBinRects(binId)
      if (binOverlapsAny(candidate, others)) return // reject resize
    }

    updateBin(binId, patch)
  }

  return (
    <div className="space-y-4">
      {binsOverlap && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          Bins overlap — move or resize bins to resolve before models can be generated.
        </div>
      )}

      {/* Bin tree with nested entities */}
      <SidebarSection title="Bins">
        {bins.length === 0 && entities.length === 0 ? (
          <p className="text-xs text-zinc-500">No bins or entities yet.</p>
        ) : (
          <div className="space-y-0.5">
            {bins.map((bin) => {
              const binEntities = entities.filter((e) => bin.entityIds.includes(e.id))
              const isBinSelected = selectionType === 'bin' && selectedIds.has(bin.id)
              return (
                <div key={bin.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                      isBinSelected
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                    onClick={() => selectBin(bin.id)}
                  >
                    <span className="font-medium">{bin.name}</span>
                    <span className="ml-2 text-zinc-600">
                      {bin.width}×{bin.depth}×{bin.height}u
                    </span>
                  </button>
                  {binEntities.length > 0 && (
                    <div className="ml-3 border-l border-zinc-800 pl-2 space-y-0.5">
                      {binEntities.map((entity) => (
                        <EntityListItem
                          key={entity.id}
                          entity={entity}
                          selected={selectionType === 'entity' && selectedIds.has(entity.id)}
                          onSelect={select}
                          onRename={(name) => updateEntity(entity.id, { name })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned entities */}
            {unassignedEntities.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Unassigned
                </p>
                <div className="space-y-0.5">
                  {unassignedEntities.map((entity) => (
                    <EntityListItem
                      key={entity.id}
                      entity={entity}
                      selected={selectionType === 'entity' && selectedIds.has(entity.id)}
                      onSelect={select}
                      onRename={(name) => updateEntity(entity.id, { name })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-1.5 mt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleAddBin}>
            Add Bin
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={unassignedEntities.length === 0}
            onClick={handleAutoWrap}
          >
            Auto-wrap
          </Button>
        </div>
      </SidebarSection>

      {selectedBin && (
        <SidebarSection title="Bin Properties">
          <BinProperties
            key={selectedBin.id}
            bin={selectedBin}
            onUpdate={(patch) => handleBinUpdate(selectedBin.id, patch)}
            onDelete={() => removeBin(selectedBin.id)}
          />
        </SidebarSection>
      )}

      {selectedEntity && (
        <EntityProperties
          key={selectedEntity.id}
          entity={selectedEntity}
          onUpdate={updateEntity}
          onDelete={() => {
            removeEntity(selectedEntity.id)
            selection.clearSelection()
          }}
        />
      )}
    </div>
  )
}

/** Headless component that auto-bakes the bin mesh via CSG worker whenever inputs change. */
function BinBaker({ bin }: { bin: Bin }): null {
  const { project, setBakeResult } = useProject()
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

function BinProperties({
  bin,
  onUpdate,
  onDelete
}: {
  bin: Bin
  onUpdate: (patch: Partial<Bin>) => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-1">
        <NumericInput
          label="W"
          value={bin.width}
          suffix="u"
          step={1}
          min={1}
          precision={0}
          onChange={(v) => onUpdate({ width: v })}
        />
        <NumericInput
          label="D"
          value={bin.depth}
          suffix="u"
          step={1}
          min={1}
          precision={0}
          onChange={(v) => onUpdate({ depth: v })}
        />
        <NumericInput
          label="H"
          value={bin.height}
          suffix="u"
          step={1}
          min={1}
          precision={0}
          onChange={(v) => onUpdate({ height: v })}
        />
      </div>
      <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
        <Checkbox
          checked={bin.hasStackingLip}
          onCheckedChange={(checked) => onUpdate({ hasStackingLip: checked === true })}
        />
        <span className="text-xs">Lip</span>
      </label>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-red-400 hover:text-red-300"
        onClick={onDelete}
      >
        Delete Bin
      </Button>
    </div>
  )
}

function EntityListItem({
  entity,
  selected,
  onSelect,
  onRename
}: {
  entity: Entity
  selected: boolean
  onSelect: (id: string) => void
  onRename: (name: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(entity.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitName = (): void => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== entity.name) {
      onRename(trimmed)
    } else {
      setEditName(entity.name)
    }
    setEditing(false)
  }

  return (
    <button
      type="button"
      className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
        selected ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800'
      }`}
      onClick={() => onSelect(entity.id)}
      onDoubleClick={() => {
        setEditName(entity.name)
        setEditing(true)
      }}
    >
      {editing ? (
        <Input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-xs font-medium border-0 border-b border-blue-400 rounded-none shadow-none px-0 py-0 focus:ring-0"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') {
              setEditName(entity.name)
              setEditing(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="font-medium">{entity.name}</span>
          <span className="ml-2 text-zinc-600">{entity.type}</span>
        </>
      )}
    </button>
  )
}

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

function EntityProperties({
  entity,
  onUpdate,
  onDelete
}: {
  entity: Entity
  onUpdate: (id: string, patch: Partial<Entity>) => void
  onDelete: () => void
}): React.JSX.Element {
  const handlePositionChange = (axis: 'x' | 'y', value: number): void => {
    onUpdate(entity.id, {
      transform: {
        ...entity.transform,
        position: { ...entity.transform.position, [axis]: value }
      }
    })
  }

  const { project } = useProject()
  const bins = project?.bins ?? []
  const unitHeight = project?.gridfinity.unitHeight ?? 7

  // Find the bin this entity belongs to (for default pocket depth)
  const ownerBin = bins.find((b) => b.entityIds.includes(entity.id))

  const handlePocketChange = (patch: Partial<PocketConfig>): void => {
    const defaultDepth = ownerBin ? computeDefaultPocketDepth(ownerBin.height, unitHeight) : 5
    const current = entity.pocket ?? { depth: defaultDepth, clearance: 0.2 }
    onUpdate(entity.id, { pocket: { ...current, ...patch } })
  }

  const handleRemovePocket = (): void => {
    onUpdate(entity.id, { pocket: undefined })
  }

  return (
    <SidebarSection title="Properties">
      <div className="space-y-2 text-xs">
        <PropertyRow label="Type" value={entity.type} />
        <NumericInput
          label="X"
          value={entity.transform.position.x}
          suffix="mm"
          step={0.5}
          fineStep={0.1}
          coarseStep={5}
          precision={1}
          onChange={(v) => handlePositionChange('x', v)}
        />
        <NumericInput
          label="Y"
          value={entity.transform.position.y}
          suffix="mm"
          step={0.5}
          fineStep={0.1}
          coarseStep={5}
          precision={1}
          onChange={(v) => handlePositionChange('y', v)}
        />
        {entity.type === 'circle' && (
          <NumericInput
            label="Diameter"
            value={entity.diameter}
            suffix="mm"
            step={0.5}
            fineStep={0.1}
            coarseStep={5}
            precision={1}
            min={0.1}
            onChange={(v) => onUpdate(entity.id, { diameter: v })}
          />
        )}
        {entity.type === 'rectangle' && (
          <>
            <NumericInput
              label="Width"
              value={entity.width}
              suffix="mm"
              step={0.5}
              fineStep={0.1}
              coarseStep={5}
              precision={1}
              min={0.1}
              onChange={(v) => onUpdate(entity.id, { width: v })}
            />
            <NumericInput
              label="Height"
              value={entity.height}
              suffix="mm"
              step={0.5}
              fineStep={0.1}
              coarseStep={5}
              precision={1}
              min={0.1}
              onChange={(v) => onUpdate(entity.id, { height: v })}
            />
          </>
        )}
        {entity.type === 'polygon' && (
          <PropertyRow label="Vertices" value={String(entity.vertices.length)} />
        )}

        <PocketControls
          entity={entity}
          onPocketChange={handlePocketChange}
          onRemovePocket={handleRemovePocket}
          defaultDepth={ownerBin ? computeDefaultPocketDepth(ownerBin.height, unitHeight) : 5}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 text-red-400 hover:text-red-300"
          onClick={onDelete}
        >
          Delete Entity
        </Button>
      </div>
    </SidebarSection>
  )
}

function PocketControls({
  entity,
  onPocketChange,
  onRemovePocket,
  defaultDepth
}: {
  entity: Entity
  onPocketChange: (patch: Partial<PocketConfig>) => void
  onRemovePocket: () => void
  defaultDepth: number
}): React.JSX.Element {
  const hasPocket = entity.pocket !== undefined

  return (
    <div className="mt-2 pt-2 border-t border-zinc-800">
      <p className="text-xs font-medium text-zinc-400 mb-1">Pocket</p>
      {hasPocket ? (
        <div className="space-y-1">
          <NumericInput
            label="Depth"
            value={entity.pocket!.depth}
            suffix="mm"
            step={0.5}
            fineStep={0.1}
            coarseStep={5}
            precision={1}
            min={0.1}
            onChange={(v) => onPocketChange({ depth: v })}
          />
          <NumericInput
            label="Clearance"
            value={entity.pocket!.clearance}
            suffix="mm"
            step={0.05}
            fineStep={0.01}
            coarseStep={0.5}
            precision={2}
            min={0}
            max={5}
            onChange={(v) => onPocketChange({ clearance: v })}
          />
          <Button variant="outline" size="sm" className="w-full mt-1" onClick={onRemovePocket}>
            Remove Pocket
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onPocketChange({ depth: defaultDepth, clearance: 0.2 })}
        >
          Add Pocket
        </Button>
      )}
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300 font-mono">{value}</span>
    </div>
  )
}
