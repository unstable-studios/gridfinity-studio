import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { NumericInput } from '@/components/ui/numeric-input'
import { setBedChoice, useBedChoice } from '@/hooks/usePrintBed'
import { BED_SIDE_LIMITS, PRINTERS } from '@/lib/print-bed'
import type { PrintBed } from '@/lib/print-bed'
import { useProject } from '@/hooks/useProject'
import { isBinGroup, useEngineState, useLayoutEngine } from '@/layout-engine'
import { useTheme } from '@unstable-studios/ui'
import { Button } from '@unstable-studios/ui'
import ColorPicker from '@/components/ui/color-picker'
import GridfinitySettings from './GridfinitySettings'
import {
  canBeNewProjectDefault,
  isNewProjectDefault,
  saveNewProjectDefaults
} from '@/lib/new-project-defaults'
import { cn } from '@/lib/utils'
import {
  loadThemeConfig,
  saveThemeConfig,
  DEFAULT_THEME_CONFIG,
  type ThemeConfig,
  type CanvasThemeColors
} from '@/lib/theme-config'
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
      <DialogContent
        className="sm:max-w-4xl"
        // Escape in a number being typed gives up the typing. It does not close Preferences.
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.matches('[data-numeric-edit]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" orientation="vertical">
          <div className="flex gap-4 h-[420px]">
            {/* Grouped by where a setting is kept: on this computer, or in the project file. */}
            <TabsList className="w-32 shrink-0 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <TabGroupLabel>App</TabGroupLabel>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="printer">Printer</TabsTrigger>
              <TabGroupLabel className="mt-3">This project</TabGroupLabel>
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
              <TabsContent value="colors">
                <ColorsTab />
              </TabsContent>
              <TabsContent value="printer">
                <PrinterTab />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function TabGroupLabel({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    // Headings for the eye only: a tab list may hold nothing but tabs.
    <p
      aria-hidden="true"
      className={cn(
        'px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
        className
      )}
    >
      {children}
    </p>
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

/** The bed a new custom size starts from. */
const STARTING_CUSTOM_BED: PrintBed = { width: 220, depth: 220 }

function PrinterTab(): React.JSX.Element {
  const choice = useBedChoice()
  const bed = choice?.bed ?? null
  const picked = choice === null ? 'none' : (choice.printer ?? 'custom')

  const pick = (value: string): void => {
    if (value === 'none') {
      setBedChoice(null)
    } else if (value === 'custom') {
      setBedChoice({ bed: bed ?? STARTING_CUSTOM_BED, printer: null })
    } else {
      const printer = PRINTERS.find((p) => p.id === value)
      if (printer) setBedChoice({ bed: printer.bed, printer: printer.id })
    }
  }
  // A size typed in is the person's own, whichever printer it started from.
  const resize = (side: Partial<PrintBed>): void => {
    if (bed) setBedChoice({ bed: { ...bed, ...side }, printer: null })
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="print-bed"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Print bed
        </label>
        <Select value={picked} onValueChange={pick}>
          <SelectTrigger id="print-bed" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {PRINTERS.map((printer) => (
              <SelectItem key={printer.id} value={printer.id}>
                {printer.name}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {bed && (
        <div className="flex w-64 gap-2">
          <NumericInput
            label="Width"
            value={bed.width}
            suffix="mm"
            step={1}
            precision={0}
            min={BED_SIDE_LIMITS.min}
            max={BED_SIDE_LIMITS.max}
            onChange={(width) => resize({ width })}
          />
          <NumericInput
            label="Depth"
            value={bed.depth}
            suffix="mm"
            step={1}
            precision={0}
            min={BED_SIDE_LIMITS.min}
            max={BED_SIDE_LIMITS.max}
            onChange={(depth) => resize({ depth })}
          />
        </div>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {bed
          ? 'Bins larger than the bed are marked in the bin list.'
          : 'Choose a bed to mark bins that are too large to print.'}
      </p>
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
          Display unit
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
  const engine = useLayoutEngine()
  // Re-read the engine whenever it changes so the lock follows the canvas.
  useEngineState()
  const hasBins = (engine?.getAllGroups() ?? []).some(isBinGroup)

  if (!project) {
    return (
      <p className="text-sm text-muted-foreground">
        Open a project to change its Gridfinity settings.
      </p>
    )
  }

  const handleChange = (config: GridfinityConfig): void => {
    updateGridfinity(config)
  }

  return (
    <div className="space-y-4">
      <GridfinitySettings config={project.gridfinity} onChange={handleChange} hasBins={hasBins} />
      <NewProjectDefaults config={project.gridfinity} />
    </div>
  )
}

/** Keep this project's settings as what new projects start with. */
function NewProjectDefaults({ config }: { config: GridfinityConfig }): React.JSX.Element {
  // The saved defaults are not React state, so a save has to ask for a new render.
  const [, setSaves] = useState(0)
  const isDefault = isNewProjectDefault(config)
  const usable = canBeNewProjectDefault(config)

  return (
    <div className="space-y-1.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={isDefault || !usable}
        onClick={() => {
          saveNewProjectDefaults(config)
          setSaves((count) => count + 1)
        }}
      >
        Use for new projects
      </Button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isDefault
          ? 'New projects start with these settings.'
          : usable
            ? 'New projects start with different settings.'
            : 'A project can’t start with these settings. Check the base unit and unit height.'}
      </p>
    </div>
  )
}

const COLOR_LABELS: Record<keyof CanvasThemeColors, string> = {
  layoutBg: 'Design background',
  layoutGrid: 'Design grid',
  reviewBg: 'Preview background',
  reviewFloor: 'Preview floor',
  reviewFog: 'Preview fog',
  meshColor: 'Model color',
  emptyState: 'Empty preview'
}

function ColorSection({
  mode,
  colors,
  onUpdate
}: {
  mode: 'dark' | 'light'
  colors: CanvasThemeColors
  onUpdate: (mode: 'dark' | 'light', key: keyof CanvasThemeColors, value: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {mode === 'dark' ? 'Dark' : 'Light'}
      </h4>
      {(Object.keys(COLOR_LABELS) as Array<keyof CanvasThemeColors>).map((key) => (
        <ColorPicker
          key={key}
          value={colors[key]}
          onChange={(value) => onUpdate(mode, key, value)}
          label={COLOR_LABELS[key]}
        />
      ))}
    </div>
  )
}

function ColorsTab(): React.JSX.Element {
  const [config, setConfig] = useState<ThemeConfig>(loadThemeConfig)

  const updateColor = (
    mode: 'dark' | 'light',
    key: keyof CanvasThemeColors,
    value: string
  ): void => {
    const updated = {
      ...config,
      [mode]: { ...config[mode], [key]: value }
    }
    setConfig(updated)
    saveThemeConfig(updated)
  }

  const resetToDefaults = (): void => {
    setConfig(DEFAULT_THEME_CONFIG)
    saveThemeConfig(DEFAULT_THEME_CONFIG)
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Canvas colors for each theme. Restart the app to apply.
      </p>
      <div className="grid grid-cols-2 gap-6">
        <ColorSection mode="dark" colors={config.dark} onUpdate={updateColor} />
        <ColorSection mode="light" colors={config.light} onUpdate={updateColor} />
      </div>
      <Button variant="outline" size="sm" onClick={resetToDefaults}>
        Reset to defaults
      </Button>
    </div>
  )
}
