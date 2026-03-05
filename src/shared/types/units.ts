export type DisplayUnit = 'mm' | 'cm' | 'in'

const CONVERSION_FACTORS: Record<DisplayUnit, number> = {
  mm: 1,
  cm: 0.1,
  in: 1 / 25.4
}

export function formatDimension(mm: number, unit: DisplayUnit): string {
  const converted = mm * CONVERSION_FACTORS[unit]
  return converted.toFixed(unit === 'in' ? 3 : 1)
}

export function parseDimension(value: string, unit: DisplayUnit): number {
  const num = parseFloat(value)
  if (isNaN(num)) return NaN
  return num / CONVERSION_FACTORS[unit]
}

export function unitLabel(unit: DisplayUnit): string {
  return unit
}
