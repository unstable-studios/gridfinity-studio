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

/** How far a left-out bin's color moves from the mesh color toward the floor. */
const LEFT_OUT_FADE = 0.75

function channels(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * Color of a bin that is unchecked for export: `meshColor` faded most of the way into
 * `floorColor`, so the bin stays visible but reads as set aside in either theme. Colors are
 * `#rrggbb`; anything else gives `meshColor` back.
 */
export function leftOutColor(meshColor: string, floorColor: string): string {
  const from = channels(meshColor)
  const to = channels(floorColor)
  if (!from || !to) return meshColor
  const mixed = from.map((channel, i) => Math.round(channel + (to[i] - channel) * LEFT_OUT_FADE))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
