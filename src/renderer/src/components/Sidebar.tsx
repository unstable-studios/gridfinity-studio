import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useProject } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import { useGeometryWorker } from '@/hooks/useGeometryWorker'
import { exportSTL as createSTLBlob } from '@/lib/stl-io'
import { meshDataToBufferGeometry } from '@/lib/mesh-convert'
import type { Entity } from '../../../shared/types/project'

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
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null

  return (
    <div className="space-y-4">
      <SidebarSection title="Entities">
        {entities.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No entities yet. Use the toolbar to create shapes.
          </p>
        ) : (
          <div className="space-y-1">
            {entities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition ${
                  selectedEntityId === entity.id
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
                onClick={() => setSelectedEntityId(entity.id)}
              >
                <span className="font-medium">{entity.name}</span>
                <span className="ml-2 text-zinc-600">{entity.type}</span>
              </button>
            ))}
          </div>
        )}
      </SidebarSection>

      {selectedEntity && <EntityProperties entity={selectedEntity} />}

      <SidebarSection title="Bin">
        <BinCreator />
      </SidebarSection>
    </div>
  )
}

function ReviewSidebar(): React.JSX.Element {
  const { bakeResult, exportSTL: doExport } = useProject()
  const { ready: workerReady } = useGeometryWorker()
  const [baking, setBaking] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleBake = useCallback(async () => {
    setBaking(true)
    // TODO: Wire actual bake pipeline when manifold booleans are ready
    setBaking(false)
  }, [])

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
          disabled={!workerReady || baking}
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

function EntityProperties({ entity }: { entity: Entity }): React.JSX.Element {
  return (
    <SidebarSection title="Properties">
      <div className="space-y-2 text-xs">
        <PropertyRow label="Name" value={entity.name} />
        <PropertyRow label="Type" value={entity.type} />
        <PropertyRow label="X" value={entity.transform.position.x.toFixed(1)} />
        <PropertyRow label="Y" value={entity.transform.position.y.toFixed(1)} />
        {entity.type === 'circle' && (
          <PropertyRow label="Diameter" value={entity.diameter.toFixed(1)} />
        )}
        {entity.type === 'rectangle' && (
          <>
            <PropertyRow label="Width" value={entity.width.toFixed(1)} />
            <PropertyRow label="Height" value={entity.height.toFixed(1)} />
          </>
        )}
        {entity.type === 'polygon' && (
          <PropertyRow label="Vertices" value={String(entity.vertices.length)} />
        )}

        <ExtrusionControls entity={entity} />
      </div>
    </SidebarSection>
  )
}

function ExtrusionControls({ entity }: { entity: Entity }): React.JSX.Element {
  const hasExtrusion = entity.extrusion !== undefined

  return (
    <div className="mt-2 pt-2 border-t border-zinc-800">
      <p className="text-xs font-medium text-zinc-400 mb-1">Extrusion</p>
      {hasExtrusion ? (
        <div className="space-y-1">
          <PropertyRow label="Depth" value={entity.extrusion!.depth.toFixed(1)} />
          <PropertyRow label="Direction" value={entity.extrusion!.direction} />
          <PropertyRow label="Role" value={entity.extrusion!.role} />
        </div>
      ) : (
        <p className="text-zinc-600 text-xs">No extrusion configured</p>
      )}
    </div>
  )
}

function BinCreator(): React.JSX.Element {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-1">
        <NumericField label="W" value={1} suffix="u" />
        <NumericField label="D" value={1} suffix="u" />
        <NumericField label="H" value={3} suffix="u" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-zinc-400">
          <input type="checkbox" className="mr-1" defaultChecked /> Lip
        </label>
        <label className="text-zinc-400">
          <input type="checkbox" className="mr-1" defaultChecked /> Magnets
        </label>
      </div>
      <Button variant="outline" size="sm" className="w-full" disabled>
        Generate Bin
      </Button>
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

function NumericField({
  label,
  value,
  suffix
}: {
  label: string
  value: number
  suffix?: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <span className="text-zinc-500 text-[10px]">{label}</span>
      <span className="text-zinc-300 font-mono">
        {value}
        {suffix}
      </span>
    </div>
  )
}
