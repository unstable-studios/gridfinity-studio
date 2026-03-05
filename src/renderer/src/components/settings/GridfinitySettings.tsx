import { useMemo } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GridfinityConfig, TolerancePreset } from '../../../../shared/types/project'
import { DEFAULT_GRIDFINITY_CONFIG, TOLERANCE_PRESETS } from '../../../../shared/types/project'

interface GridfinitySettingsProps {
  config: GridfinityConfig
  onChange: (config: GridfinityConfig) => void
}

const PRESET_KEYS: TolerancePreset[] = ['tight', 'standard', 'loose']

function detectTolerancePreset(tolerance: number): TolerancePreset | 'custom' {
  for (const key of PRESET_KEYS) {
    if (tolerance === TOLERANCE_PRESETS[key]) return key
  }
  return 'custom'
}

export default function GridfinitySettings({
  config,
  onChange
}: GridfinitySettingsProps): React.JSX.Element {
  const activePreset = useMemo(() => detectTolerancePreset(config.tolerance), [config.tolerance])

  function selectPreset(preset: TolerancePreset): void {
    onChange({ ...config, tolerance: TOLERANCE_PRESETS[preset] })
  }

  function updateNumber(key: 'baseUnit' | 'unitHeight' | 'tolerance', raw: string): void {
    const value = parseFloat(raw)
    if (!isNaN(value)) {
      if (key === 'baseUnit') {
        // Keep gridSpacing in sync with baseUnit
        onChange({ ...config, baseUnit: value, gridSpacing: value })
      } else {
        onChange({ ...config, [key]: value })
      }
    }
  }

  function handleReset(): void {
    onChange(structuredClone(DEFAULT_GRIDFINITY_CONFIG))
  }

  return (
    <div className="space-y-5">
      {/* Grid dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Base Unit"
          value={config.baseUnit}
          suffix="mm"
          onChange={(v) => updateNumber('baseUnit', v)}
        />
        <NumberField
          label="Unit Height"
          value={config.unitHeight}
          suffix="mm"
          onChange={(v) => updateNumber('unitHeight', v)}
        />
      </div>

      {/* Tolerance with inline preset */}
      <div>
        <Label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Tolerance
        </Label>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              step={0.1}
              value={config.tolerance}
              onChange={(e) => updateNumber('tolerance', e.target.value)}
              className="w-20"
            />
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">mm</span>
          </div>
          <ToggleGroup
            type="single"
            value={activePreset === 'custom' ? '' : activePreset}
            onValueChange={(value) => {
              if (value) selectPreset(value as TolerancePreset)
            }}
          >
            {PRESET_KEYS.map((key) => (
              <ToggleGroupItem key={key} value={key} className="px-2">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Mounting options */}
      <div className="space-y-3">
        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Mounting Options
        </Label>
        <ToggleRow
          label="Magnet Holes"
          description={`${config.magnetHoles.diameter}mm dia, ${config.magnetHoles.depth}mm deep`}
          checked={config.magnetHoles.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...config, magnetHoles: { ...config.magnetHoles, enabled: checked } })
          }
        />
        <ToggleRow
          label="Screw Holes"
          description={`${config.screwHoles.diameter}mm dia, ${config.screwHoles.depth}mm deep`}
          checked={config.screwHoles.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...config, screwHoles: { ...config.screwHoles, enabled: checked } })
          }
        />
      </div>

      {/* Reset */}
      <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
        Reset to Defaults
      </Button>
    </div>
  )
}

/* ── Internal sub-components ──────────────────────────────────────── */

function NumberField({
  label,
  value,
  suffix,
  step = 1,
  onChange
}: {
  label: string
  value: number
  suffix?: string
  step?: number
  onChange: (raw: string) => void
}): React.JSX.Element {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && (
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border border-transparent bg-zinc-100/80 px-3 py-2 text-sm dark:bg-zinc-800/80">
      <div>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
