import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useProject } from '@/hooks/useProject'
import { useTheme } from '@unstable-studios/ui'
import GridfinitySettings from './GridfinitySettings'
import type { DisplayUnit } from '../../../../shared/types/units'
import type { GridfinityConfig } from '../../../../shared/types/project'

interface PreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PreferencesModal({
  open,
  onOpenChange
}: PreferencesModalProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" orientation="vertical">
          <div className="flex gap-4 h-[420px]">
            <TabsList className="w-32 shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="gridfinity">Gridfinity</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-w-0 overflow-y-auto">
              <TabsContent value="general">
                <GeneralTab />
              </TabsContent>
              <TabsContent value="units">
                <UnitsTab />
              </TabsContent>
              <TabsContent value="gridfinity">
                <GridfinityTab />
              </TabsContent>
            </div>
          </div>
        </Tabs>
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
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(value) => {
            if (value) setTheme(value as 'system' | 'light' | 'dark')
          }}
        >
          <ToggleGroupItem value="system">System</ToggleGroupItem>
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

function UnitsTab(): React.JSX.Element {
  const { project, updateSettings } = useProject()
  const currentUnit = (project?.settings.units ?? 'mm') as DisplayUnit

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Display Unit
        </label>
        <ToggleGroup
          type="single"
          value={currentUnit}
          onValueChange={(value) => {
            if (value) updateSettings({ units: value as DisplayUnit })
          }}
        >
          <ToggleGroupItem value="mm">mm</ToggleGroupItem>
          <ToggleGroupItem value="cm">cm</ToggleGroupItem>
          <ToggleGroupItem value="in">in</ToggleGroupItem>
        </ToggleGroup>
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
