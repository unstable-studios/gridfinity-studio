/**
 * The bin a drag on the canvas draws: the whole grid cells between where the drag started
 * and where the pointer is.
 */
import type { Point } from './draw-box'

export interface DrawnBin {
  /** Lower-left corner, as a `LayoutGroup` stores it: the largest y, since y grows downward. */
  x: number
  y: number
  width: number
  height: number
  widthUnits: number
  depthUnits: number
}

/**
 * Bin covering every grid cell from the one under `start` to the one under `current`.
 * A drag that never leaves its cell makes a 1×1 bin.
 */
export function binFromDrag(start: Point, current: Point, baseUnit: number): DrawnBin {
  const cell = (value: number): number => Math.floor(value / baseUnit)
  const firstColumn = Math.min(cell(start.x), cell(current.x))
  const lastColumn = Math.max(cell(start.x), cell(current.x))
  const firstRow = Math.min(cell(start.y), cell(current.y))
  const lastRow = Math.max(cell(start.y), cell(current.y))
  const widthUnits = lastColumn - firstColumn + 1
  const depthUnits = lastRow - firstRow + 1
  return {
    x: firstColumn * baseUnit,
    y: (lastRow + 1) * baseUnit,
    width: widthUnits * baseUnit,
    height: depthUnits * baseUnit,
    widthUnits,
    depthUnits
  }
}
