/**
 * Choosing bins for export in the 3D preview: telling a click from an orbit, and how a bin
 * that is left out looks.
 */

/** A press that moves further than this, in pixels, is a drag: it orbits and picks nothing. */
export const CLICK_SLOP_PX = 4

/** Whether a press that moved `distancePx` before release was a click. */
export function isClick(distancePx: number): boolean {
  return distancePx <= CLICK_SLOP_PX
}

function channels(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * Color of a bin that is unchecked for export: `meshColor` with its color taken out, a gray
 * of about the same brightness. Colors are `#rrggbb`; anything else gives `meshColor` back.
 */
export function leftOutColor(meshColor: string): string {
  const rgb = channels(meshColor)
  if (!rgb) return meshColor
  const gray = Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2])
  return `#${gray.toString(16).padStart(2, '0').repeat(3)}`
}

/** How solid a left-out bin is drawn, from 0 (not there) to 1 (solid). */
export const LEFT_OUT_OPACITY = 0.45

/** Glow of a checked bin, as the material's emissive intensity. */
const CHECKED_GLOW = 0.16
/** Glow added to the bin under the pointer. */
const HOVER_GLOW = 0.2
/**
 * Glow of a left-out bin under the pointer. A see-through bin shows only `LEFT_OUT_OPACITY`
 * of its glow, so this is set higher than what should reach the screen: less than a checked
 * bin's glow, or the bin would look checked before it is clicked.
 */
const LEFT_OUT_HOVER_GLOW = 0.25

/**
 * How strongly a bin glows in the mesh color. A checked bin always glows the same, whether or
 * not another bin is left out. A left-out bin does not. The bin under the pointer glows more,
 * when it can be clicked.
 */
export function glowIntensity(bin: { checked: boolean; hovered: boolean }): number {
  const resting = bin.checked ? CHECKED_GLOW : 0
  if (!bin.hovered) return resting
  return resting + (bin.checked ? HOVER_GLOW : LEFT_OUT_HOVER_GLOW)
}
