import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { GridfinityConfig, TolerancePreset } from '../../../../shared/types/project'
import { GRIDFINITY_PRESETS, TOLERANCE_PRESETS } from '../../../../shared/types/project'

interface GridfinitySettingsProps {
  config: GridfinityConfig
  onChange: (config: GridfinityConfig) => void
}

const PRESET_KEYS: TolerancePreset[] = ['tight', 'standard', 'loose']

function detectPreset(config: GridfinityConfig): TolerancePreset | 'custom' {
  for (const key of PRESET_KEYS) {
    const preset = GRIDFINITY_PRESETS[key]
    if (
      config.baseUnit === preset.baseUnit &&
      config.gridSpacing === preset.gridSpacing &&
      config.unitHeight === preset.unitHeight &&
      config.tolerance === preset.tolerance &&
      config.magnetHoles.enabled === preset.magnetHoles.enabled &&
      config.magnetHoles.diameter === preset.magnetHoles.diameter &&
      config.magnetHoles.depth === preset.magnetHoles.depth &&
      config.screwHoles.enabled === preset.screwHoles.enabled &&
      config.screwHoles.diameter === preset.screwHoles.diameter &&
      config.screwHoles.depth === preset.screwHoles.depth
    ) {
      return key
    }
  }
  return 'custom'
}

export default function GridfinitySettings({
  config,
  onChange
}: GridfinitySettingsProps): React.JSX.Element {
  const [activePreset, setActivePreset] = useState<TolerancePreset | 'custom'>(() =>
    detectPreset(config)
  )

  useEffect(() => {
    setActivePreset(detectPreset(config))
  }, [config])

  function selectPreset(preset: TolerancePreset): void {
    const presetConfig = structuredClone(GRIDFINITY_PRESETS[preset])
    setActivePreset(preset)
    onChange(presetConfig)
  }

  function updateField<K extends keyof GridfinityConfig>(key: K, value: GridfinityConfig[K]): void {
    onChange({ ...config, [key]: value })
  }

  function updateNumber(key: keyof GridfinityConfig, raw: string): void {
    const value = parseFloat(raw)
    if (!isNaN(value)) {
      updateField(key, value as GridfinityConfig[typeof key])
    }
  }

  function toggleMagnetHoles(): void {
    onChange({
      ...config,
      magnetHoles: { ...config.magnetHoles, enabled: !config.magnetHoles.enabled }
    })
  }

  function toggleScrewHoles(): void {
    onChange({
      ...config,
      screwHoles: { ...config.screwHoles, enabled: !config.screwHoles.enabled }
    })
  }

  return (
    <div className="space-y-5">
      {/* Preset selector */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Tolerance Preset
        </label>
        <div className="flex gap-2">
          {PRESET_KEYS.map((key) => (
            <Button
              key={key}
              size="sm"
              variant={activePreset === key ? 'default' : 'outline'}
              onClick={() => selectPreset(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <span className="ml-1 text-xs opacity-60">{TOLERANCE_PRESETS[key]}mm</span>
            </Button>
          ))}
          {activePreset === 'custom' && (
            <Button size="sm" variant="secondary" disabled>
              Custom
            </Button>
          )}
        </div>
      </div>

      {/* Numeric fields */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Base Unit"
          value={config.baseUnit}
          suffix="mm"
          onChange={(v) => updateNumber('baseUnit', v)}
        />
        <NumberField
          label="Grid Spacing"
          value={config.gridSpacing}
          suffix="mm"
          onChange={(v) => updateNumber('gridSpacing', v)}
        />
        <NumberField
          label="Unit Height"
          value={config.unitHeight}
          suffix="mm"
          onChange={(v) => updateNumber('unitHeight', v)}
        />
        <NumberField
          label="Tolerance"
          value={config.tolerance}
          suffix="mm"
          step={0.1}
          onChange={(v) => updateNumber('tolerance', v)}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Mounting Options
        </label>
        <Toggle
          label="Magnet Holes"
          description={`${config.magnetHoles.diameter}mm dia, ${config.magnetHoles.depth}mm deep`}
          checked={config.magnetHoles.enabled}
          onChange={toggleMagnetHoles}
        />
        <Toggle
          label="Screw Holes"
          description={`${config.screwHoles.diameter}mm dia, ${config.screwHoles.depth}mm deep`}
          checked={config.screwHoles.enabled}
          onChange={toggleScrewHoles}
        />
      </div>
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
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-800 shadow-xs outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-zinc-500"
        />
        {suffix && (
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-lg border border-transparent bg-zinc-100/80 px-3 py-2 text-left text-sm transition hover:border-zinc-300 dark:bg-zinc-800/80 dark:hover:border-zinc-700"
    >
      <div>
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}
