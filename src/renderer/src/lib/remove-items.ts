import type { LayoutEngine } from '@/layout-engine'

/**
 * Remove bins and shapes as one undo step. A bin goes with everything in it: removing only
 * the bin would leave its shapes lying on the canvas.
 */
export function removeItems(engine: LayoutEngine, ids: string[]): void {
  const doomed = new Set(ids)
  if (doomed.size === 0) return
  const shapes = engine.getAllShapes()
  engine.clearSelection()
  engine.batch(() => {
    for (const shape of shapes) {
      const inDoomedBin = shape.groupId !== null && doomed.has(shape.groupId)
      if (inDoomedBin || doomed.has(shape.id)) engine.removeShape(shape.id)
    }
    for (const id of doomed) {
      if (engine.getGroup(id)) engine.removeGroup(id)
    }
  })
}
