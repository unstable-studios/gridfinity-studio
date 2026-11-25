import { useEffect, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { Button } from '@unstable-studios/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import StudioLogo from '../assets/StudioIcon.svg?react'
import { updateMenuItems, type UpdateAction } from '@/lib/update-menu'
import { cn } from '@/lib/utils'
import type { UpdateState } from '../../../shared/types/updates'

type License = { name: string; version: string; license: string; text: string }

const TONES = {
  good: 'text-green-700 dark:text-green-400',
  bad: 'text-red-700 dark:text-red-400'
}

/** Name, version, update state, and the licenses of what the app is built with. */
export default function AboutDialog({
  open,
  onOpenChange,
  updateState,
  updateActions
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  updateState: UpdateState
  updateActions: Record<UpdateAction, () => void>
}): React.JSX.Element {
  // The list is large and only needed here, so it loads when the dialog first opens.
  const [licenses, setLicenses] = useState<License[] | 'failed' | null>(null)
  useEffect(() => {
    if (!open || licenses) return
    let cancelled = false
    import('virtual:third-party-licenses').then(
      (module) => {
        if (!cancelled) setLicenses(module.default)
      },
      () => {
        if (!cancelled) setLicenses('failed')
      }
    )
    return () => {
      cancelled = true
    }
  }, [open, licenses])

  const versions = window.electron?.process.versions

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <StudioLogo className="size-10 shrink-0" />
            <div className="min-w-0">
              <DialogTitle>Gridfinity Studio</DialogTitle>
              <p className="text-xs text-zinc-500">Version {__APP_VERSION__}</p>
            </div>
          </div>
          <DialogDescription>
            Design Gridfinity bins with custom pockets, preview them in 3D, and export them for
            printing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {updateMenuItems(updateState).map(({ label, action, tone }) =>
            action ? (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => updateActions[action]()}
              >
                {label}
              </Button>
            ) : (
              <span
                key={label}
                className={cn('text-zinc-700 dark:text-zinc-300', tone && TONES[tone])}
              >
                {label}
              </span>
            )
          )}
        </div>

        <p className="text-xs text-zinc-500">
          © Unstable Studios. MIT license.
          {versions && (
            <>
              {' '}
              Electron {versions.electron}, Chromium {versions.chrome}, Node {versions.node}.
            </>
          )}
        </p>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Open-source licenses
          </h3>
          <div className="h-56 overflow-y-auto rounded-md border border-zinc-200 text-xs dark:border-zinc-800">
            {licenses === null ? (
              <p className="p-2 text-zinc-500">Loading…</p>
            ) : licenses === 'failed' ? (
              <p className="p-2 text-red-700 dark:text-red-400">
                Couldn’t load the list. Close this window and open it again.
              </p>
            ) : (
              licenses.map((entry) => (
                <details
                  key={`${entry.name}@${entry.version}`}
                  className="group border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
                >
                  <summary className="flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                    <ChevronRightIcon className="size-3 shrink-0 text-zinc-400 transition-transform group-open:rotate-90" />
                    <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                      {entry.name}
                      {entry.version && <span className="text-zinc-500"> {entry.version}</span>}
                    </span>
                    <span className="shrink-0 text-zinc-500">{entry.license}</span>
                  </summary>
                  <pre className="whitespace-pre-wrap px-2 pb-2 pt-1 font-sans text-[11px] text-zinc-600 dark:text-zinc-400">
                    {entry.text || 'This package includes no license file.'}
                  </pre>
                </details>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
