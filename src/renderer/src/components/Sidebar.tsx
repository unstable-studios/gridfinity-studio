import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@unstable-studios/ui'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import { useSharedSelection } from '@/hooks/useSelection'

import { exportSTL as createSTLBlob } from '@/lib/stl-io'
import { meshDataToBufferGeometry } from '@/lib/mesh-convert'
import { generateBinMesh } from '@/lib/bin-generator'
import { extrudePolygon } from '@/lib/extrude'
import type { Entity, Bin, ExtrusionConfig, Vertex2D } from '../../../shared/types/project'
import type { AuxMesh } from '@/hooks/useProject'
import { formatDimension, parseDimension, unitLabel } from '../../../shared/types/units'
import type { DisplayUnit } from '../../../shared/types/units'

export default function Sidebar(): React.JSX.Element {
  const { mode } = useAppMode()
  const { project } = useProject()

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-zinc-300/80 bg-white/80 px-4 py-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 overflow-y-auto">
      {mode === 'layout' ? <LayoutSidebar entities={project?.entities ?? []} /> : <ReviewSidebar />}
    </aside>
  )
}

function LayoutSidebar({ entities }: { entities: Entity[] }): React.JSX.Element {
  const { project, updateEntity, removeEntity, addBin, updateBin, removeBin } = useProject()
  const selection = useSharedSelection()
  const { selectedIds, selectionType, select, selectBin } = selection

  const bins = project?.bins ?? []
  const baseUnit = project?.gridfinity.baseUnit ?? 42

  const selectedEntity =
    selectionType === 'entity' && selectedIds.size > 0
      ? (entities.find((e) => selectedIds.has(e.id)) ?? null)
      : null

  const selectedBin =
    selectionType === 'bin' && selectedIds.size > 0
      ? (bins.find((b) => selectedIds.has(b.id)) ?? null)
      : null

  const handleAddBin = (): void => {
    // Find next available grid-aligned position
    const occupied = new Set(bins.map((b) => `${b.position.x},${b.position.y}`))
    let posX = 0
    let posY = 0
    // Try positions along x-axis first, then wrap
    while (occupied.has(`${posX},${posY}`)) {
      posX += baseUnit
      if (posX > baseUnit * 10) {
        posX = 0
        posY += baseUnit
      }
    }
    const bin = addBin({ position: { x: posX, y: posY } })
    selectBin(bin.id)
  }

  return (
    <div className="space-y-4">
      <SidebarSection title="Bins">
        {bins.length === 0 ? (
          <p className="text-xs text-zinc-500">No bins yet. Add one to get started.</p>
        ) : (
          <div className="space-y-1">
            {bins.map((bin) => (
              <button
                key={bin.id}
                type="button"
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                  selectionType === 'bin' && selectedIds.has(bin.id)
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
                onClick={() => selectBin(bin.id)}
              >
                <span className="font-medium">{bin.name}</span>
                <span className="ml-2 text-zinc-600">
                  {bin.width}x{bin.depth}x{bin.height}u
                </span>
              </button>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleAddBin}>
          Add Bin
        </Button>
      </SidebarSection>

      {selectedBin && (
        <SidebarSection title="Bin Properties">
          <BinProperties
            bin={selectedBin}
            onUpdate={(patch) => updateBin(selectedBin.id, patch)}
            onDelete={() => removeBin(selectedBin.id)}
          />
        </SidebarSection>
      )}

      <SidebarSection title="Entities">
        {entities.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No entities yet. Use the toolbar to create shapes.
          </p>
        ) : (
          <div className="space-y-1">
            {entities.map((entity) => (
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
      </SidebarSection>
      {selectedEntity && (
        <EntityProperties
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

function BinProperties({
  bin,
  onUpdate,
  onDelete
}: {
  bin: Bin
  onUpdate: (patch: Partial<Bin>) => void
  onDelete: () => void
}): React.JSX.Element {
  const { project, setBakeResult } = useProject()

  useEffect(() => {
    if (!project) return
    const gridCfg = project.gridfinity
    const binMesh = generateBinMesh({
      widthUnits: bin.width,
      depthUnits: bin.depth,
      heightUnits: bin.height,
      baseUnit: gridCfg.baseUnit,
      unitHeight: gridCfg.unitHeight,
      tolerance: gridCfg.tolerance,
      hasLip: bin.hasStackingLip,
      hasDividers: bin.hasDividers,
      magnetHoles: gridCfg.magnetHoles,
      screwHoles: gridCfg.screwHoles
    })

    setBakeResult({
      mesh: {
        positions: binMesh.positions,
        colors: binMesh.colors,
        indices: binMesh.indices,
        normals: binMesh.normals
      },
      auxMeshes: [],
      timestamp: Date.now(),
      dirty: false,
      warnings: []
    })
  }, [project, setBakeResult, bin.width, bin.depth, bin.height, bin.hasStackingLip])

  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-1">
        <EditableNumericField
          label="W"
          value={bin.width}
          suffix="u"
          onChange={(v) => onUpdate({ width: v })}
        />
        <EditableNumericField
          label="D"
          value={bin.depth}
          suffix="u"
          onChange={(v) => onUpdate({ depth: v })}
        />
        <EditableNumericField
          label="H"
          value={bin.height}
          suffix="u"
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

function ReviewSidebar(): React.JSX.Element {
  const { bakeResult, setBakeResult, project, exportSTL: doExport } = useProject()
  const [baking, setBaking] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleBake = useCallback(async () => {
    if (!project) return
    setBaking(true)
    try {
      const binConfig = project.bins[0]
      const gridCfg = project.gridfinity

      const binMesh = generateBinMesh({
        widthUnits: binConfig?.width ?? 1,
        depthUnits: binConfig?.depth ?? 1,
        heightUnits: binConfig?.height ?? 3,
        baseUnit: gridCfg.baseUnit,
        unitHeight: gridCfg.unitHeight,
        tolerance: gridCfg.tolerance,
        hasLip: binConfig?.hasStackingLip ?? true,
        hasDividers: binConfig?.hasDividers ?? false,
        magnetHoles: gridCfg.magnetHoles,
        screwHoles: gridCfg.screwHoles
      })

      // Generate extrusion meshes for entities with extrusion config
      const auxMeshes: AuxMesh[] = []
      for (const entity of project.entities) {
        if (!entity.extrusion || entity.extrusion.depth <= 0) continue

        let vertices: Vertex2D[] = []
        const pos = entity.transform.position

        if (entity.type === 'rectangle') {
          const hw = entity.width / 2
          const hh = entity.height / 2
          vertices = [
            { x: pos.x - hw, y: pos.y - hh },
            { x: pos.x + hw, y: pos.y - hh },
            { x: pos.x + hw, y: pos.y + hh },
            { x: pos.x - hw, y: pos.y + hh }
          ]
        } else if (entity.type === 'circle') {
          const r = entity.diameter / 2
          const segments = 32
          vertices = Array.from({ length: segments }, (_, i) => {
            const angle = (2 * Math.PI * i) / segments
            return { x: pos.x + r * Math.cos(angle), y: pos.y + r * Math.sin(angle) }
          })
        } else if (entity.type === 'polygon') {
          vertices = entity.vertices
        }

        if (vertices.length >= 3) {
          const extruded = extrudePolygon(
            vertices,
            entity.extrusion.depth,
            entity.extrusion.direction
          )
          auxMeshes.push({
            mesh: {
              positions: extruded.positions,
              indices: extruded.indices,
              normals: extruded.normals,
              colors: new Float32Array(0)
            },
            role: entity.extrusion.role,
            entityId: entity.id
          })
        }
      }

      setBakeResult({
        mesh: {
          positions: binMesh.positions,
          colors: binMesh.colors,
          indices: binMesh.indices,
          normals: binMesh.normals
        },
        auxMeshes,
        timestamp: Date.now(),
        dirty: false,
        warnings: []
      })
    } finally {
      setBaking(false)
    }
  }, [project, setBakeResult])

  const handleExport = useCallback(async () => {
    if (!bakeResult) return
    setExporting(true)
    try {
      const geometry = meshDataToBufferGeometry(bakeResult.mesh)
      const blob = createSTLBlob(geometry)
      const buffer = await blob.arrayBuffer()
      await doExport(buffer)
    } finally {
      setExporting(false)
    }
  }, [bakeResult, doExport])

  return (
    <div className="space-y-4">
      <SidebarSection title="Bake">
        <p className="text-xs text-zinc-500 mb-2">
          Combine bin mesh with cutters to produce the final model.
        </p>
        <Button
          variant="outline"
          className="w-full"
          disabled={baking}
          onClick={() => void handleBake()}
        >
          {baking ? 'Baking...' : bakeResult?.dirty ? 'Re-bake Model' : 'Bake Model'}
        </Button>
        {bakeResult && !bakeResult.dirty && (
          <p className="text-xs text-green-500 mt-1">Baked successfully</p>
        )}
        {bakeResult?.dirty && (
          <p className="text-xs text-amber-500 mt-1">Design changed — re-bake needed</p>
        )}
      </SidebarSection>

      <SidebarSection title="Export">
        <Button
          variant="outline"
          className="w-full"
          disabled={!bakeResult || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? 'Exporting...' : 'Export STL'}
        </Button>
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
  const { project } = useProject()
  const unit = (project?.settings.units ?? 'mm') as DisplayUnit

  const handlePositionChange = (axis: 'x' | 'y', value: number): void => {
    onUpdate(entity.id, {
      transform: {
        ...entity.transform,
        position: { ...entity.transform.position, [axis]: value }
      }
    })
  }

  const handleExtrusionChange = (patch: Partial<ExtrusionConfig>): void => {
    const current = entity.extrusion ?? {
      depth: 5,
      direction: 'down' as const,
      role: 'cutter' as const
    }
    onUpdate(entity.id, { extrusion: { ...current, ...patch } })
  }

  return (
    <SidebarSection title="Properties">
      <div className="space-y-2 text-xs">
        <PropertyRow label="Type" value={entity.type} />
        <EditableNumberRow
          label={`X (${unitLabel(unit)})`}
          value={entity.transform.position.x}
          unit={unit}
          onChange={(v) => handlePositionChange('x', v)}
        />
        <EditableNumberRow
          label={`Y (${unitLabel(unit)})`}
          value={entity.transform.position.y}
          unit={unit}
          onChange={(v) => handlePositionChange('y', v)}
        />
        {entity.type === 'circle' && (
          <EditableNumberRow
            label={`Diameter (${unitLabel(unit)})`}
            value={entity.diameter}
            unit={unit}
            onChange={(v) => onUpdate(entity.id, { diameter: Math.max(0.1, v) })}
          />
        )}
        {entity.type === 'rectangle' && (
          <>
            <EditableNumberRow
              label={`Width (${unitLabel(unit)})`}
              value={entity.width}
              unit={unit}
              onChange={(v) => onUpdate(entity.id, { width: Math.max(0.1, v) })}
            />
            <EditableNumberRow
              label={`Height (${unitLabel(unit)})`}
              value={entity.height}
              unit={unit}
              onChange={(v) => onUpdate(entity.id, { height: Math.max(0.1, v) })}
            />
          </>
        )}
        {entity.type === 'polygon' && (
          <PropertyRow label="Vertices" value={String(entity.vertices.length)} />
        )}

        <ExtrusionControls entity={entity} onExtrusionChange={handleExtrusionChange} />
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

function ExtrusionControls({
  entity,
  onExtrusionChange
}: {
  entity: Entity
  onExtrusionChange: (patch: Partial<ExtrusionConfig>) => void
}): React.JSX.Element {
  const hasExtrusion = entity.extrusion !== undefined

  return (
    <div className="mt-2 pt-2 border-t border-zinc-800">
      <p className="text-xs font-medium text-zinc-400 mb-1">Extrusion</p>
      {hasExtrusion ? (
        <div className="space-y-1">
          <EditableNumberRow
            label="Depth"
            value={entity.extrusion!.depth}
            onChange={(v) => {
              if (v > 0) onExtrusionChange({ depth: v })
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Direction</span>
            <Select
              value={entity.extrusion!.direction}
              onValueChange={(v) => onExtrusionChange({ direction: v as 'up' | 'down' })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="up">Up</SelectItem>
                <SelectItem value="down">Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Role</span>
            <Select
              value={entity.extrusion!.role}
              onValueChange={(v) => onExtrusionChange({ role: v as 'solid' | 'cutter' })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="cutter">Cutter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={() => onExtrusionChange({ depth: 0 })}
          >
            Remove Extrusion
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onExtrusionChange({ depth: 5, direction: 'down', role: 'cutter' })}
        >
          Add Extrusion
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

function EditableNumberRow({
  label,
  value,
  unit,
  onChange
}: {
  label: string
  value: number
  unit?: DisplayUnit
  onChange: (value: number) => void
}): React.JSX.Element {
  const displayUnit = unit ?? 'mm'
  const [localValue, setLocalValue] = useState(formatDimension(value, displayUnit))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from external changes (e.g. gizmo drag)
  useEffect(() => {
    setLocalValue(formatDimension(value, displayUnit))
  }, [value, displayUnit])

  const commit = useCallback(
    (raw: string) => {
      const mm = parseDimension(raw, displayUnit)
      if (!isNaN(mm)) onChange(mm)
    },
    [onChange, displayUnit]
  )

  const handleChange = (raw: string): void => {
    setLocalValue(raw)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => commit(raw), 150)
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <Input
        type="number"
        className="w-20 font-mono text-xs text-right py-0.5 px-1"
        value={localValue}
        step={0.1}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit(localValue)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(localValue)
        }}
      />
    </div>
  )
}

function EditableNumericField({
  label,
  value,
  suffix,
  onChange
}: {
  label: string
  value: number
  suffix?: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <span className="text-zinc-500 text-[10px]">{label}</span>
      <div className="flex items-center gap-0.5">
        <Input
          type="number"
          className="w-10 font-mono text-xs text-center py-0.5 px-1"
          value={value}
          min={1}
          step={1}
          onChange={(e) => {
            const num = parseInt(e.target.value)
            if (!isNaN(num) && num > 0) onChange(num)
          }}
        />
        {suffix && <span className="text-zinc-500 text-[10px]">{suffix}</span>}
      </div>
    </div>
  )
}
