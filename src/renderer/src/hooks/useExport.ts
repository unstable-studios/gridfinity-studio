/**
 * Exporting the baked bins: which ones, whether they are ready, and writing the file.
 * The top bar and the File menu both export through this, so they always agree.
 */
import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useLayoutEngine, useEngineState, isBinGroup } from '@/layout-engine'
import type { BinMetadata, LayoutGroup } from '@/layout-engine'
import { useAppMode } from './useAppMode'
import { useProject } from './useProject'
import { useProjectName } from './useProjectName'
import { buildSTLArrayBuffer, build3MFArrayBuffer, placementsFromGroups } from '@/lib/export-baked'
import { checkedBins, exportTitle } from '@/lib/export-plan'
import { storedName } from '@/lib/item-name'
import type { BatchExportFile, ExportFormat } from '../../../shared/types/export'

/** One file holding every exported bin, or a file for each. */
export type ExportFiles = 'one' | 'perBin'

type Bin = LayoutGroup & { metadata: BinMetadata }

/**
 * What the person asked for. Bins are checked until unchecked, so a new bin starts checked.
 * `useExportChoiceReset` checks them all again.
 */
const useExportOptions = create<{ unchecked: string[]; files: ExportFiles }>(() => ({
  unchecked: [],
  files: 'one'
}))

export interface ExportCommands {
  /** Every bin in the project. */
  bins: Bin[]
  /** The checked bins: what an export would hold now. */
  chosen: Bin[]
  setChecked: (binId: string, checked: boolean) => void
  setAllChecked: (checked: boolean) => void
  /** `perBin` only while the project has more than one bin. */
  files: ExportFiles
  setFiles: (files: ExportFiles) => void
  /** Whether every chosen bin has been built, in Preview. */
  canExport: boolean
  exportAs: (format: ExportFormat) => Promise<void>
}

export function useExport(): ExportCommands {
  const engine = useLayoutEngine()
  const { tick } = useEngineState()
  const { mode } = useAppMode()
  const bakeResults = useProject((s) => s.bakeResults)
  const bakeStatus = useProject((s) => s.bakeStatus)
  const exportSTL = useProject((s) => s.exportSTL)
  const export3MF = useProject((s) => s.export3MF)
  const exportBatch = useProject((s) => s.exportBatch)
  const projectName = useProjectName()
  const unchecked = useExportOptions((s) => s.unchecked)
  const wantedFiles = useExportOptions((s) => s.files)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bins = useMemo(() => (engine?.getAllGroups() ?? []).filter(isBinGroup), [engine, tick])
  // With one bin there is nothing to choose, and no checkbox is shown.
  const chosen = useMemo(
    () => (bins.length > 1 ? checkedBins(bins, unchecked) : bins),
    [bins, unchecked]
  )
  const files: ExportFiles = bins.length > 1 ? wantedFiles : 'one'

  // Bins are only built in Preview. In Design the last build can be out of date.
  const canExport =
    mode === 'review' && chosen.length > 0 && chosen.every((b) => bakeStatus.get(b.id) === 'ready')

  const exportAs = useCallback(
    async (format: ExportFormat) => {
      /** One file holding `binsInFile`. Without `placed`, a bin sits at the origin. */
      const build = async (
        binsInFile: Bin[],
        title: string,
        placed: boolean
      ): Promise<ArrayBuffer | null> => {
        const meshes = new Map(
          binsInFile.flatMap((bin) => {
            const baked = bakeResults.get(bin.id)
            return baked ? [[bin.id, baked] as const] : []
          })
        )
        const placements = placed ? placementsFromGroups(binsInFile) : undefined
        return format === 'stl'
          ? buildSTLArrayBuffer(meshes, placements)
          : build3MFArrayBuffer(meshes, title, placements)
      }
      const save = format === 'stl' ? exportSTL : export3MF
      const binName = (bin: Bin): string => storedName(bin.metadata) ?? 'Bin'

      if (files === 'perBin') {
        const built: BatchExportFile[] = []
        for (const bin of chosen) {
          const data = await build([bin], binName(bin), false)
          if (data) built.push({ name: binName(bin), data })
        }
        // A single file needs no folder: it goes through the ordinary save dialog.
        if (built.length === 1) await save(built[0].data, `${built[0].name}.${format}`)
        else if (built.length > 1) await exportBatch(built, format)
        return
      }

      const title = exportTitle(
        projectName,
        bins,
        chosen.map((bin) => ({ id: bin.id, name: storedName(bin.metadata) }))
      )
      const data = await build(chosen, title, true)
      if (data) await save(data, `${title}.${format}`)
    },
    [bakeResults, bins, chosen, export3MF, exportBatch, exportSTL, files, projectName]
  )

  return {
    bins,
    chosen,
    setChecked: (binId, checked) =>
      useExportOptions.setState((s) => ({
        unchecked: checked ? s.unchecked.filter((id) => id !== binId) : [...s.unchecked, binId]
      })),
    setAllChecked: (checked) =>
      useExportOptions.setState({ unchecked: checked ? [] : bins.map((bin) => bin.id) }),
    files,
    setFiles: (next) => useExportOptions.setState({ files: next }),
    canExport,
    exportAs
  }
}

/**
 * Check every bin again when the person leaves Preview or the project changes. A bin is then
 * only ever left out by a choice made with the bins in view, never by one left over from
 * earlier that would quietly export part of a project. Mount once.
 */
export function useExportChoiceReset(): void {
  const { mode } = useAppMode()
  const projectKey = useProject((s) => s.project?.settings.createdAt)
  useEffect(() => {
    useExportOptions.setState({ unchecked: [] })
  }, [mode, projectKey])
}
