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
