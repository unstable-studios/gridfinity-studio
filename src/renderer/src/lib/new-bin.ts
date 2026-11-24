/**
 * Adding a bin to the layout, from the sidebar's size grid or by drawing it on the canvas.
 */
import { isBinGroup } from '@/layout-engine/types'
import type { BinMetadata } from '@/layout-engine/types'
import type { LayoutEngine } from '@/layout-engine/interface'
import { storedName } from './item-name'

export interface NewBin {
  /** Lower-left corner. */
  x: number
  y: number
  widthUnits: number
  depthUnits: number
}

/** "Bin 4" when the highest numbered bin is "Bin 3", so a name is not handed out twice. */
export function nextBinName(names: Array<string | undefined>): string {
  let highest = 0
  for (const name of names) {
    const number = Number(name?.match(/^Bin (\d+)$/)?.[1] ?? 0)
    if (number > highest) highest = number
  }
  return `Bin ${highest + 1}`
}

/** A row of new bins is at least this many grid units wide before the next row starts. */
const ROW_UNITS = 12

interface Placed {
  /** Lower-left corner. */
  x: number
  y: number
  width: number
  height: number
}

/**
 * Where a bin added from the size grid goes: the first free place reading left to right, then
 * down a row, that leaves one grid unit clear around the new bin. Rows start at the left
 * edge of the layout and are as wide as it, or `ROW_UNITS` if that is wider, so bins wrap
 * instead of running off in one line. Returns the lower-left corner.
 */
export function placeForNewBin(
  existing: Placed[],
  widthUnits: number,
  depthUnits: number,
  unit: number
): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 }

  const width = widthUnits * unit
  const height = depthUnits * unit
  // Rows and columns stay on the canvas grid even if the bin they start from is off it.
  const onGrid = (value: number): number => Math.round(value / unit) * unit
  const left = onGrid(Math.min(...existing.map((bin) => bin.x)))
  const right = Math.max(...existing.map((bin) => bin.x + bin.width))
  // Rows are counted down from the bottom edge of the highest bin.
  const firstBaseline = onGrid(Math.min(...existing.map((bin) => bin.y)))
  const lowest = Math.max(...existing.map((bin) => bin.y))
  const columns = Math.max(ROW_UNITS, Math.ceil((right - left) / unit), widthUnits)
  // Slightly less than a unit, so a bin exactly one unit away is far enough.
  const gap = unit - 1e-6
  const isFree = (x: number, y: number): boolean =>
    existing.every(
      (bin) =>
        x + width + gap <= bin.x ||
        bin.x + bin.width <= x - gap ||
        y + gap <= bin.y - bin.height ||
        bin.y <= y - height - gap
    )

  // One row past the lowest bin is always free, so the search ends.
  const rows = Math.ceil((lowest - firstBaseline) / unit) + depthUnits + 2
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column + widthUnits <= columns; column++) {
      const x = left + column * unit
      const y = firstBaseline + row * unit
      if (isFree(x, y)) return { x, y }
    }
  }
  return { x: left, y: lowest + height + unit }
}

/**
 * Add a bin, select it, and return its id. One undo step.
 *
 * With `adoptShapes`, shapes that are in no bin and whose middle is inside the new one become
 * its pockets: drawing a bin around a shape puts the shape in the bin.
 */
export function addBin(
  engine: LayoutEngine,
  bin: NewBin,
  baseUnit: number,
  options: { adoptShapes?: boolean } = {}
): string {
  const id = crypto.randomUUID()
  const width = bin.widthUnits * baseUnit
  const height = bin.depthUnits * baseUnit
  const metadata: BinMetadata = {
    widthUnits: bin.widthUnits,
    depthUnits: bin.depthUnits,
    heightUnits: 3,
    hasLip: true,
    name: nextBinName(
      engine
        .getAllGroups()
        .filter(isBinGroup)
        .map((group) => storedName(group.metadata))
    )
  }
  // The lower-left corner has the largest y: the bin reaches up from it.
  const inside = (shape: { x: number; y: number }): boolean =>
    shape.x >= bin.x && shape.x <= bin.x + width && shape.y <= bin.y && shape.y >= bin.y - height
  const adopted = options.adoptShapes
    ? engine.getAllShapes().filter((shape) => shape.groupId === null && inside(shape))
    : []

  engine.batch(() => {
    engine.createGroup({
      id,
      x: bin.x,
      y: bin.y,
      width,
      height,
      rotation: 0,
      childIds: [],
      style: {
        fill: 'rgba(96, 165, 250, 0.05)',
        stroke: '#60a5fa',
        strokeWidth: 1,
        cornerRadius: 4
      },
      metadata
    })
    for (const shape of adopted) engine.addToGroup(shape.id, id)
  })
  engine.select([id])
  return id
}
