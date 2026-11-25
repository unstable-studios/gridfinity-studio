import { useState } from 'react'
import { NumericInput } from '@/components/ui/numeric-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@unstable-studios/ui'
import type { TolerancePreset } from '../../../../shared/types/project'
import { TOLERANCE_PRESETS } from '../../../../shared/types/project'
import { loadNewProjectDefaults } from '@/lib/new-project-defaults'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Without `tolerance`, the project keeps the one new projects start with. */
  onCreate: (config: { name: string; baseUnit: number; tolerance?: number }) => void
}

/** The preset with this tolerance, if one has it. */
function presetFor(tolerance: number): TolerancePreset | null {
  const match = (['tight', 'standard', 'loose'] as const).find(
    (preset) => TOLERANCE_PRESETS[preset] === tolerance
  )
  return match ?? null
}

export default function NewProjectDialog({
  open,
  onOpenChange,
  onCreate
}: NewProjectDialogProps): React.JSX.Element {
  const [name, setName] = useState('Untitled project')
  // The grid starts as new projects do: the person's saved defaults, or the app's.
  const [defaults, setDefaults] = useState(loadNewProjectDefaults)
  const [baseUnit, setBaseUnit] = useState(defaults.baseUnit)
  // No preset is picked when the saved tolerance is not one of them.
  const [preset, setPreset] = useState<TolerancePreset | null>(presetFor(defaults.tolerance))

  // Each time the dialog opens, start from the defaults as they are now: they may have been
  // saved in Preferences since it was last shown.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = loadNewProjectDefaults()
      setDefaults(next)
      setName('Untitled project')
      setBaseUnit(next.baseUnit)
      setPreset(presetFor(next.tolerance))
    }
  }

  const handleCreate = (): void => {
    onCreate({
      name: name.trim() || 'Untitled project',
      baseUnit,
      ...(preset ? { tolerance: TOLERANCE_PRESETS[preset] } : {})
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Set the grid for this project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
              Name
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              autoFocus
            />
          </div>

          <NumericInput
            label="Base unit"
            value={baseUnit}
            suffix="mm"
            step={1}
            min={10}
            max={100}
            precision={0}
            onChange={setBaseUnit}
          />

          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
              Tolerance
            </label>
            <div className="flex gap-1.5">
              {(['tight', 'standard', 'loose'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    preset === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
                  onClick={() => setPreset(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                  <span className="block text-[10px] opacity-70">{TOLERANCE_PRESETS[p]} mm</span>
                </button>
              ))}
            </div>
            {preset === null && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Your default, {defaults.tolerance} mm.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
