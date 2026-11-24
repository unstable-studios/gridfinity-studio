/**
 * Exporting the baked bins: which ones, whether they are ready, and writing the file.
 * The sidebar and the File menu both export through this, so they always agree.
 */
import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { useLayoutEngine, useEngineState, isBinGroup } from '@/layout-engine'
import type { BinMetadata, LayoutGroup } from '@/layout-engine'
import { useAppMode } from './useAppMode'
import { useProject } from './useProject'
import { useProjectName } from './useProjectName'
import { buildSTLArrayBuffer, build3MFArrayBuffer, placementsFromGroups } from '@/lib/export-baked'
import { binsInSelection, exportTitle } from '@/lib/export-plan'
import type { ExportScope } from '@/lib/export-plan'
import { storedName } from '@/lib/item-name'

export type ExportFormat = 'stl' | '3mf'

type Bin = LayoutGroup & { metadata: BinMetadata }

/** What the person last asked for. Kept while the app is open, across projects. */
const useExportOptions = create<{ scope: ExportScope }>(() => ({ scope: 'all' }))

export interface ExportCommands {
  /** Every bin in the project. */
  bins: Bin[]
  /** The bins the selection points at. */
  selectedBins: Bin[]
  /** The bins an export would hold now. */
  chosen: Bin[]
  /** `selected` only while there are selected bins to export. */
  scope: ExportScope
  setScope: (scope: ExportScope) => void
  /** Whether every chosen bin is built and up to date. */
  canExport: boolean
  exportAs: (format: ExportFormat) => Promise<void>
}

export function useExport(): ExportCommands {
  const engine = useLayoutEngine()
  const { tick, selectedIds } = useEngineState()
  const { mode } = useAppMode()
  const bakeResults = useProject((s) => s.bakeResults)
  const bakeStatus = useProject((s) => s.bakeStatus)
  const exportSTL = useProject((s) => s.exportSTL)
  const export3MF = useProject((s) => s.export3MF)
  const projectName = useProjectName()
  const wantedScope = useExportOptions((s) => s.scope)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bins = useMemo(() => (engine?.getAllGroups() ?? []).filter(isBinGroup), [engine, tick])
  const selectedBins = useMemo(
    () => binsInSelection(bins, engine?.getAllShapes() ?? [], selectedIds),
    [bins, engine, selectedIds]
  )

  const scope: ExportScope =
    wantedScope === 'selected' && selectedBins.length > 0 ? 'selected' : 'all'
  const chosen = scope === 'selected' ? selectedBins : bins

  // Bins are only built in Preview. In Design the last build can be out of date.
  const canExport =
    mode === 'review' && chosen.length > 0 && chosen.every((b) => bakeStatus.get(b.id) === 'ready')

  const exportAs = useCallback(
    async (format: ExportFormat) => {
      const meshes = new Map(
        chosen.flatMap((bin) => {
          const baked = bakeResults.get(bin.id)
          return baked ? [[bin.id, baked] as const] : []
        })
      )
      const title = exportTitle(
        projectName,
        bins,
        chosen.map((bin) => ({ id: bin.id, name: storedName(bin.metadata) }))
      )
      const placements = placementsFromGroups(chosen)
      if (format === 'stl') {
        const data = await buildSTLArrayBuffer(meshes, placements)
        if (data) await exportSTL(data, `${title}.stl`)
      } else {
        const data = await build3MFArrayBuffer(meshes, title, placements)
        if (data) await export3MF(data, `${title}.3mf`)
      }
    },
    [bakeResults, bins, chosen, export3MF, exportSTL, projectName]
  )

  return {
    bins,
    selectedBins,
    chosen,
    scope,
    setScope: (next) => useExportOptions.setState({ scope: next }),
    canExport,
    exportAs
  }
}
