/**
 * Calculate keep-out regions for a Gridfinity bin.
 *
 * Keep-out zones are areas where entities should not be placed because
 * they would interfere with magnet holes, screw holes, or the stacking lip.
 */

import type { GridfinityConfig } from '../../../shared/types/project'

export interface KeepOutCircle {
  cx: number
  cy: number
  radius: number
  type: 'magnet' | 'screw'
}

export interface KeepOutInset {
  inset: number
  type: 'lip'
}

export interface KeepOutRegions {
  circles: KeepOutCircle[]
  lipInset: KeepOutInset | null
}

const HOLE_OFFSET = 8 // mm from cell edge to hole center

/**
 * Compute keep-out regions for a bin.
 *
 * @param widthUnits - Bin width in grid units
 * @param depthUnits - Bin depth in grid units
 * @param config - Gridfinity configuration
 * @param hasLip - Whether the bin has a stacking lip
 * @returns Keep-out regions in bin-local coordinates (origin at bin center)
 */
export function computeKeepOut(
  widthUnits: number,
  depthUnits: number,
  config: GridfinityConfig,
  hasLip: boolean
): KeepOutRegions {
  const { baseUnit, magnetHoles, screwHoles } = config
  const circles: KeepOutCircle[] = []

  const widthMm = widthUnits * baseUnit
  const depthMm = depthUnits * baseUnit

  // Hole positions: one in each corner of each grid cell
  // offset from cell edges by HOLE_OFFSET
  for (let gx = 0; gx < widthUnits; gx++) {
    for (let gy = 0; gy < depthUnits; gy++) {
      const cellLeft = gx * baseUnit - widthMm / 2
      const cellBottom = gy * baseUnit - depthMm / 2

      const corners = [
        { cx: cellLeft + HOLE_OFFSET, cy: cellBottom + HOLE_OFFSET },
        { cx: cellLeft + baseUnit - HOLE_OFFSET, cy: cellBottom + HOLE_OFFSET },
        { cx: cellLeft + HOLE_OFFSET, cy: cellBottom + baseUnit - HOLE_OFFSET },
        { cx: cellLeft + baseUnit - HOLE_OFFSET, cy: cellBottom + baseUnit - HOLE_OFFSET }
      ]

      for (const pos of corners) {
        if (magnetHoles.enabled) {
          circles.push({
            cx: pos.cx,
            cy: pos.cy,
            radius: magnetHoles.diameter / 2,
            type: 'magnet'
          })
        }
        if (screwHoles.enabled) {
          circles.push({
            cx: pos.cx,
            cy: pos.cy,
            radius: screwHoles.diameter / 2,
            type: 'screw'
          })
        }
      }
    }
  }

  // Lip inset keep-out (entities near the edge will interfere with the lip)
  const lipInset: KeepOutInset | null = hasLip ? { inset: 2.85, type: 'lip' } : null

  return { circles, lipInset }
}
