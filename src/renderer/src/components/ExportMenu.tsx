import { useState } from 'react'
import { ChevronDownIcon, DownloadIcon } from 'lucide-react'
import { Button } from '@unstable-studios/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useExport } from '@/hooks/useExport'
import { useProject } from '@/hooks/useProject'
import { cn } from '@/lib/utils'
import type { ExportFormat } from '../../../shared/types/export'

/** Export in the top bar, in Preview: what to export, and the two formats. */
export default function ExportMenu({ className }: { className?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const bakeStatus = useProject((s) => s.bakeStatus)
  const { bins, selectedBins, chosen, scope, setScope, files, setFiles, canExport, exportAs } =
    useExport()
  const anyError = chosen.some((bin) => bakeStatus.get(bin.id) === 'error')

  const run = (format: ExportFormat): void => {
    setOpen(false)
    void exportAs(format)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={bins.length === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition select-none outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950',
            className
          )}
        >
          <DownloadIcon className="size-3.5" />
          Export
          <ChevronDownIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-3">
        {bins.length > 1 && (
          <>
            <ToggleGroup
              type="single"
              aria-label="Bins to export"
              className="flex w-full"
              value={scope}
              onValueChange={(value) => {
                if (value === 'all' || value === 'selected') setScope(value)
              }}
            >
              <ToggleGroupItem value="all" className="flex-1 justify-center">
                All bins
              </ToggleGroupItem>
              <ToggleGroupItem
                value="selected"
                className="flex-1 justify-center disabled:opacity-50"
                disabled={selectedBins.length === 0}
              >
                Selected ({selectedBins.length})
              </ToggleGroupItem>
            </ToggleGroup>
            {selectedBins.length === 0 && (
              <p className="text-[10px] text-zinc-500">
                Click bins in the list to export only those.
              </p>
            )}
            <ToggleGroup
              type="single"
              aria-label="Files to export"
              className="flex w-full"
              value={files}
              onValueChange={(value) => {
                if (value === 'one' || value === 'perBin') setFiles(value)
              }}
            >
              <ToggleGroupItem value="one" className="flex-1 justify-center">
                One file
              </ToggleGroupItem>
              <ToggleGroupItem value="perBin" className="flex-1 justify-center">
                File per bin
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        )}
        <Button
          variant="default"
          className="w-full"
          disabled={!canExport}
          onClick={() => run('3mf')}
        >
          Export 3MF…
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={!canExport}
          onClick={() => run('stl')}
        >
          Export STL…
        </Button>
        {!canExport && (
          <p className="text-[10px] text-zinc-500">
            {anyError ? 'Couldn’t build one or more bins.' : 'Building the model…'}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
