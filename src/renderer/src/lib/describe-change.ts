/**
 * What an edit did, in a few words, for the undo history: worked out from the layout before
 * and after it, so every way of making a change is named the same.
 */
import type { LayoutGroup, LayoutShape, LayoutSnapshot } from '@/layout-engine/types'
import { storedName } from './item-name'
import { shapeTypeLabel } from './shape-labels'

/** "Bin 2", or "bin" for one with no name. */
function binName(bin: LayoutGroup): string {
  return storedName(bin.metadata) ?? 'bin'
}

/** "Slot", or "rectangle" for one with no name. */
function shapeName(shape: LayoutShape): string {
  return storedName(shape.metadata) ?? shapeTypeLabel(shape.type).toLowerCase()
}

/** "Bin 2" for one, "3 bins" for several. */
function binsPhrase(bins: LayoutGroup[]): string {
  return bins.length === 1 ? binName(bins[0]) : `${bins.length} bins`
}

function shapesPhrase(shapes: LayoutShape[]): string {
  return shapes.length === 1 ? shapeName(shapes[0]) : `${shapes.length} shapes`
}

/** Bins and shapes together, as when a bin is pasted with its pockets. */
function itemsPhrase(bins: LayoutGroup[], shapes: LayoutShape[]): string {
  if (shapes.length === 0) return binsPhrase(bins)
  if (bins.length === 0) return shapesPhrase(shapes)
  return `${bins.length + shapes.length} items`
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The fields that say how big a shape is, whatever its kind. */
function size(shape: LayoutShape): unknown {
  const s = shape as unknown as Record<string, unknown>
  return [s.width, s.height, s.radiusX, s.radiusY, s.points, s.pathData, s.scaleX, s.scaleY]
}

function metadataWithoutName(metadata: Record<string, unknown> | undefined): unknown {
  return Object.fromEntries(Object.entries(metadata ?? {}).filter(([key]) => key !== 'name'))
}

type Kind = 'Rename' | 'Resize' | 'Rotate' | 'Move' | 'Change'

/** The most telling thing that changed about a bin. */
function binChange(before: LayoutGroup, after: LayoutGroup): Kind | null {
  if (before.width !== after.width || before.height !== after.height) return 'Resize'
  if (before.x !== after.x || before.y !== after.y) return 'Move'
  if (storedName(before.metadata) !== storedName(after.metadata)) return 'Rename'
  if (!same(metadataWithoutName(before.metadata), metadataWithoutName(after.metadata))) {
    return 'Change'
  }
  return null
}

function shapeChange(before: LayoutShape, after: LayoutShape): Kind | null {
  if (!same(size(before), size(after))) return 'Resize'
  if (before.rotation !== after.rotation) return 'Rotate'
  // A shape that changes bin has moved too: its position is kept relative to its bin.
  if (before.x !== after.x || before.y !== after.y || before.groupId !== after.groupId) {
    return 'Move'
  }
  if (storedName(before.metadata) !== storedName(after.metadata)) return 'Rename'
  if (!same({ ...before, metadata: null }, { ...after, metadata: null })) return 'Change'
  if (!same(metadataWithoutName(before.metadata), metadataWithoutName(after.metadata))) {
    return 'Change'
  }
  return null
}

/** One kind if every change is of that kind, otherwise "Change". */
function commonKind(kinds: Kind[]): Kind {
  return kinds.every((kind) => kind === kinds[0]) ? kinds[0] : 'Change'
}

/** What turned the layout `before` into `after`, such as "Move Bin 2" or "Add rectangle". */
export function describeChange(before: LayoutSnapshot, after: LayoutSnapshot): string {
  const binsBefore = new Map(before.groups.map((bin) => [bin.id, bin]))
  const binsAfter = new Map(after.groups.map((bin) => [bin.id, bin]))
  const shapesBefore = new Map(before.shapes.map((shape) => [shape.id, shape]))
  const shapesAfter = new Map(after.shapes.map((shape) => [shape.id, shape]))

  const addedBins = after.groups.filter((bin) => !binsBefore.has(bin.id))
  const addedShapes = after.shapes.filter((shape) => !shapesBefore.has(shape.id))
  const removedBins = before.groups.filter((bin) => !binsAfter.has(bin.id))
  const removedShapes = before.shapes.filter((shape) => !shapesAfter.has(shape.id))

  const added = addedBins.length + addedShapes.length
  const removed = removedBins.length + removedShapes.length
  if (added > 0 && removed > 0) return 'Replace items'
  if (added > 0) return `Add ${itemsPhrase(addedBins, addedShapes)}`
  if (removed > 0) return `Delete ${itemsPhrase(removedBins, removedShapes)}`

  const changedBins: Array<{ bin: LayoutGroup; kind: Kind }> = []
  for (const bin of after.groups) {
    const kind = binChange(binsBefore.get(bin.id)!, bin)
    if (kind) changedBins.push({ bin, kind })
  }
  const changedShapes: Array<{ shape: LayoutShape; kind: Kind }> = []
  for (const shape of after.shapes) {
    const kind = shapeChange(shapesBefore.get(shape.id)!, shape)
    if (kind) changedShapes.push({ shape, kind })
  }

  // Pockets ride along when their bin moves, so a bin's change names the step.
  if (changedBins.length > 0) {
    const kind = commonKind(changedBins.map((change) => change.kind))
    return `${kind} ${binsPhrase(changedBins.map((change) => change.bin))}`
  }
  if (changedShapes.length > 0) {
    const kind = commonKind(changedShapes.map((change) => change.kind))
    return `${kind} ${shapesPhrase(changedShapes.map((change) => change.shape))}`
  }
  return 'Change layout'
}
