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

/**
 * How far a left-out bin's color moves from the mesh color toward the floor. Less on a dark
 * floor, where a bin faded as far as on a light one can no longer be made out.
 */
const LEFT_OUT_FADE = { lightFloor: 0.75, darkFloor: 0.55 }

/** A floor darker than this, from 0 (black) to 1 (white), counts as dark. */
const DARK_FLOOR = 0.25

/** Rough brightness of a color, from 0 (black) to 1 (white). */
function brightness([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function channels(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * Color of a bin that is unchecked for export: `meshColor` faded toward `floorColor`, so the
 * bin stays visible but reads as set aside in either theme. Colors are
 * `#rrggbb`; anything else gives `meshColor` back.
 */
export function leftOutColor(meshColor: string, floorColor: string): string {
  const from = channels(meshColor)
  const to = channels(floorColor)
  if (!from || !to) return meshColor
  const fade = brightness(to) < DARK_FLOOR ? LEFT_OUT_FADE.darkFloor : LEFT_OUT_FADE.lightFloor
  const mixed = from.map((channel, i) => Math.round(channel + (to[i] - channel) * fade))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Glow of a checked bin while some bin is left out, as the material's emissive intensity. */
const CHECKED_GLOW = 0.16
/** Glow added to the bin under the pointer. */
const HOVER_GLOW = 0.2
/**
 * Glow of a left-out bin under the pointer. Much less, because the glow is in the color of a
 * checked bin: more would make the bin look checked before it is clicked.
 */
const LEFT_OUT_HOVER_GLOW = 0.07

/**
 * How strongly a bin glows in the mesh color. A checked bin glows only while `choosing`, that
 * is, while some bin is left out: with every bin checked a glow would mark nothing. The bin
 * under the pointer glows more, when it can be clicked.
 */
export function glowIntensity(bin: {
  checked: boolean
  choosing: boolean
  hovered: boolean
}): number {
  const resting = bin.checked && bin.choosing ? CHECKED_GLOW : 0
  if (!bin.hovered) return resting
  return resting + (bin.checked ? HOVER_GLOW : LEFT_OUT_HOVER_GLOW)
}
