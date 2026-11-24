/**
 * Adding a bin to the layout, from the sidebar's size grid or by drawing it on the canvas.
 */
import { isBinGroup } from '@/layout-engine/types'
import type { BinMetadata } from '@/layout-engine/types'
import type { LayoutEngine } from '@/layout-engine/interface'

export interface NewBin {
  /** Lower-left corner. */
  x: number
  y: number
  widthUnits: number
  depthUnits: number
}

/** Add a bin, select it, and return its id. One undo step. */
export function addBin(engine: LayoutEngine, bin: NewBin, baseUnit: number): string {
  const id = crypto.randomUUID()
  const metadata: BinMetadata = {
    widthUnits: bin.widthUnits,
    depthUnits: bin.depthUnits,
    heightUnits: 3,
    hasLip: true,
    name: `Bin ${engine.getAllGroups().filter(isBinGroup).length + 1}`
  }
  engine.createGroup({
    id,
    x: bin.x,
    y: bin.y,
    width: bin.widthUnits * baseUnit,
    height: bin.depthUnits * baseUnit,
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
  engine.select([id])
  return id
}
