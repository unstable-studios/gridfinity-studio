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

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (config: { name: string; baseUnit: number; tolerance: number }) => void
}

export default function NewProjectDialog({
  open,
  onOpenChange,
  onCreate
}: NewProjectDialogProps): React.JSX.Element {
  const [name, setName] = useState('Untitled Project')
  const [baseUnit, setBaseUnit] = useState(42)
  const [preset, setPreset] = useState<TolerancePreset>('standard')

  const handleCreate = (): void => {
    onCreate({
      name: name.trim() || 'Untitled Project',
      baseUnit,
      tolerance: TOLERANCE_PRESETS[preset]
    })
    onOpenChange(false)
    // Reset for next time
    setName('Untitled Project')
    setBaseUnit(42)
    setPreset('standard')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setName('Untitled Project')
          setBaseUnit(42)
          setPreset('standard')
        }
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Configure Gridfinity grid settings. These can be changed later in Preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
              Project Name
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
            label="Base Unit"
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
              Tolerance Preset
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
                  <span className="block text-[10px] opacity-70">{TOLERANCE_PRESETS[p]}mm</span>
                </button>
              ))}
            </div>
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
