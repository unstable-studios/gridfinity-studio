import type { LayoutEngine } from './interface'
import type { ShapeAABB } from './containment'
import { ALIGN_MODES } from './arrange'
import type { AlignMode, ArrangeBox } from './arrange'

export interface ArrangeTarget {
  boxes: ArrangeBox[]
  /** What the shapes align to. Absent means the box that encloses them. */
  frame?: ShapeAABB
  modes: AlignMode[]
  /** Distributing needs at least three shapes. */
  canDistribute: boolean
}

/**
 * What the current selection can be aligned to. Two or more shapes align to
 * each other. One shape in a bin can be centered in that bin; its edges are
 * not offered, since a pocket flush with the bin's edge cuts through the wall.
 * Bins themselves are not arranged here.
 */
export function arrangeTarget(engine: LayoutEngine, selectedIds: string[]): ArrangeTarget | null {
  const boxes: ArrangeBox[] = []
  for (const id of selectedIds) {
    const bounds = engine.getShapeBounds(id)
    if (!bounds) return null
    boxes.push({ id, ...bounds })
  }

  if (boxes.length >= 2) {
    return { boxes, modes: [...ALIGN_MODES], canDistribute: boxes.length >= 3 }
  }
  if (boxes.length === 1) {
    const groupId = engine.getShape(boxes[0].id)?.groupId
    const bin = groupId ? engine.getGroup(groupId) : undefined
    if (!bin) return null
    return {
      boxes,
      frame: { minX: bin.x, minY: bin.y - bin.height, maxX: bin.x + bin.width, maxY: bin.y },
      modes: ['centerX', 'centerY'],
      canDistribute: false
    }
  }
  return null
}
