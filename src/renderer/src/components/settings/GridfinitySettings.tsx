import { useMemo } from 'react'
import { Button } from '@unstable-studios/ui'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GridfinityConfig, TolerancePreset } from '../../../../shared/types/project'
import {
  DEFAULT_GRIDFINITY_CONFIG,
  TOLERANCE_PRESETS,
  newBinDefaults
} from '../../../../shared/types/project'

interface GridfinitySettingsProps {
  config: GridfinityConfig
  onChange: (config: GridfinityConfig) => void
  hasBins?: boolean
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
  onChange,
  hasBins = false
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

  const newBin = newBinDefaults(config)

  function updateNewBinHeight(raw: string): void {
    const value = Math.round(parseFloat(raw))
    if (!isNaN(value) && value >= 1)
      onChange({ ...config, newBin: { ...newBin, heightUnits: value } })
  }

  function handleReset(): void {
    const defaults = structuredClone(DEFAULT_GRIDFINITY_CONFIG)
    // Existing bins are sized for the current base unit, so it stays locked.
    onChange(
      hasBins
        ? { ...defaults, baseUnit: config.baseUnit, gridSpacing: config.gridSpacing }
        : defaults
    )
  }

  return (
    <div className="space-y-5">
      {/* Grid dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Base unit"
          value={config.baseUnit}
          suffix="mm"
          disabled={hasBins}
          onChange={(v) => updateNumber('baseUnit', v)}
        />
        <NumberField
          label="Unit height"
          value={config.unitHeight}
          suffix="mm"
          onChange={(v) => updateNumber('unitHeight', v)}
        />
      </div>
      {hasBins && <p className="text-xs text-zinc-500">Remove all bins to change the base unit.</p>}

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
          Mounting options
        </Label>
        <ToggleRow
          label="Magnet holes"
          description={`${config.magnetHoles.diameter} mm diameter, ${config.magnetHoles.depth} mm deep`}
          checked={config.magnetHoles.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...config, magnetHoles: { ...config.magnetHoles, enabled: checked } })
          }
        />
        <ToggleRow
          label="Screw holes"
          description={`${config.screwHoles.diameter} mm diameter, ${config.screwHoles.depth} mm deep`}
          checked={config.screwHoles.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...config, screwHoles: { ...config.screwHoles, enabled: checked } })
          }
        />
      </div>

      {/* What a bin added from now on starts with. Bins already in the project keep theirs. */}
      <div className="space-y-3">
        <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          New bins
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Height"
            value={newBin.heightUnits}
            suffix="units"
            min={1}
            onChange={updateNewBinHeight}
          />
        </div>
        <ToggleRow
          label="Stacking lip"
          checked={newBin.hasLip}
          onCheckedChange={(checked) =>
            onChange({ ...config, newBin: { ...newBin, hasLip: checked } })
          }
        />
      </div>

      {/* Reset */}
      <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
        Reset to defaults
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
  min,
  disabled,
  onChange
}: {
  label: string
  value: number
  suffix?: string
  step?: number
  min?: number
  disabled?: boolean
  onChange: (raw: string) => void
}): React.JSX.Element {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          aria-label={label}
          step={step}
          min={min}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
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
