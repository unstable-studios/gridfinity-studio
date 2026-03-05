import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProject } from '@/hooks/useProject'
import { useTheme } from '@unstable-studios/ui'
import GridfinitySettings from './GridfinitySettings'
import type { DisplayUnit } from '../../../../shared/types/units'
import type { GridfinityConfig } from '../../../../shared/types/project'

type Tab = 'general' | 'units' | 'gridfinity'

interface PreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'units', label: 'Units' },
  { id: 'gridfinity', label: 'Gridfinity' }
]

export default function PreferencesModal({
  open,
  onOpenChange
}: PreferencesModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 min-h-[300px]">
          <nav className="flex flex-col gap-1 w-32 shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-md text-left transition ${
                  activeTab === tab.id
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex-1 min-w-0">
            {activeTab === 'general' && <GeneralTab />}
            {activeTab === 'units' && <UnitsTab />}
            {activeTab === 'gridfinity' && <GridfinityTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralTab(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Theme
        </label>
        <div className="flex gap-2">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md border transition ${
                theme === t
                  ? 'border-foreground bg-zinc-200 dark:bg-zinc-800 font-medium'
                  : 'border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTheme(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function UnitsTab(): React.JSX.Element {
  const { project, updateSettings } = useProject()
  const currentUnit = (project?.settings.units ?? 'mm') as DisplayUnit

  const units: DisplayUnit[] = ['mm', 'cm', 'in']

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Display Unit
        </label>
        <div className="flex gap-2">
          {units.map((u) => (
            <button
              key={u}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md border transition ${
                currentUnit === u
                  ? 'border-foreground bg-zinc-200 dark:bg-zinc-800 font-medium'
                  : 'border-zinc-200 dark:border-zinc-800 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => updateSettings({ units: u })}
            >
              {u}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          All internal values are stored in millimetres. This setting only affects display.
        </p>
      </div>
    </div>
  )
}

function GridfinityTab(): React.JSX.Element {
  const { project, updateGridfinity } = useProject()

  if (!project) {
    return (
      <p className="text-sm text-muted-foreground">
        Open a project to configure Gridfinity settings.
      </p>
    )
  }

  const handleChange = (config: GridfinityConfig): void => {
    updateGridfinity(config)
  }

  return <GridfinitySettings config={project.gridfinity} onChange={handleChange} />
}
