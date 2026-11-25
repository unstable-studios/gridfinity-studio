/**
 * What copy and paste do to bins and shapes, worked out on plain data. The hook
 * `useEditCommands` applies the result to the layout engine.
 */
import type { LayoutGroup, LayoutShape } from '@/layout-engine/types'

/** How far a pasted shape lands from the one it was copied from, in mm. */
export const PASTE_OFFSET = 10

export interface ClipboardContent {
  /** Copied bins, at the positions they were copied from. */
  groups: LayoutGroup[]
  /**
   * Copied shapes, with x and y on the canvas (not relative to a bin). `groupId` names a
   * copied bin the shape belongs to, or is null for a shape copied on its own.
   */
  shapes: LayoutShape[]
}

/** Center of a group on the canvas. Its x and y are the lower-left corner. */
function centerOf(group: LayoutGroup): { x: number; y: number } {
  return { x: group.x + group.width / 2, y: group.y - group.height / 2 }
}

/**
 * What a copy of the selection holds: each selected bin with everything in it, and each
 * selected shape that is not already inside one of those bins. Null when that is nothing.
 *
 * `shapes` are as the engine reports them: a shape in a bin has x and y relative to the
 * center of its bin.
 */
export function copySelection(
  groups: LayoutGroup[],
  shapes: LayoutShape[],
  selectedIds: string[]
): ClipboardContent | null {
  const selected = new Set(selectedIds)
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const copiedGroups = groups.filter((g) => selected.has(g.id))
  const copiedGroupIds = new Set(copiedGroups.map((g) => g.id))

  const copiedShapes: LayoutShape[] = []
  for (const shape of shapes) {
    const inCopiedGroup = shape.groupId !== null && copiedGroupIds.has(shape.groupId)
    if (!inCopiedGroup && !selected.has(shape.id)) continue
    const parent = shape.groupId === null ? undefined : groupById.get(shape.groupId)
    const origin = parent ? centerOf(parent) : { x: 0, y: 0 }
    copiedShapes.push({
      ...structuredClone(shape),
      x: shape.x + origin.x,
      y: shape.y + origin.y,
      groupId: inCopiedGroup ? shape.groupId : null
    })
  }

  if (copiedGroups.length === 0 && copiedShapes.length === 0) return null
  return { groups: copiedGroups.map((g) => structuredClone(g)), shapes: copiedShapes }
}

export interface PastePlan {
  /** New bins, with new ids and no children yet. */
  groups: LayoutGroup[]
  /** New shapes, with new ids and x and y on the canvas. */
  shapes: LayoutShape[]
  /** For each new shape that belongs in a new bin: shape id to bin id. */
  shapeGroup: Map<string, string>
}

/** Whether two groups cover any of the same area. Touching edges do not count. */
function overlaps(a: LayoutGroup, b: LayoutGroup): boolean {
  const apart =
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y <= b.y - b.height || b.y <= a.y - a.height
  return !apart
}

/** A copy of `metadata` under the name a paste gives it. No metadata stays no metadata. */
function renamed(
  metadata: Record<string, unknown> | undefined,
  name: string | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined
  const copy = structuredClone(metadata)
  if (name === undefined) delete copy.name
  else copy.name = name
  return copy
}

/** "Bin 1" becomes "Bin 1 copy". A name that already says so is left alone. */
function copyName(name: unknown): string | undefined {
  if (typeof name !== 'string' || name === '') return undefined
  return / copy$/.test(name) ? name : `${name} copy`
}

/**
 * Where a paste puts things.
 *
 * Bins keep their arrangement. They go back where they were copied from when that space is
 * free, as after a cut. Otherwise they go to the right of every bin on the canvas, one grid
 * unit clear, so a pasted bin never lands on another. Shapes copied on their own land a
 * little down and to the right of where they were, further with each paste of the same copy.
 *
 * `pasteCount` is how many paste offsets to apply: 0 for the first paste after a cut, which
 * lands in place, and 1 or more for copies.
 */
export function planPaste(
  content: ClipboardContent,
  existingGroups: LayoutGroup[],
  baseUnit: number,
  pasteCount: number,
  newId: () => string
): PastePlan {
  // The first paste after a cut puts back the things themselves, under their own names.
  // Every other paste makes a copy, named so it can be told from the original.
  const nameFor = (name: unknown): string | undefined =>
    pasteCount === 0 ? (typeof name === 'string' ? name : undefined) : copyName(name)

  let binShift = 0
  const spaceIsTaken = content.groups.some((copied) =>
    existingGroups.some((existing) => overlaps(copied, existing))
  )
  if (spaceIsTaken) {
    const rightEdge = Math.max(...existingGroups.map((g) => g.x + g.width))
    const leftEdge = Math.min(...content.groups.map((g) => g.x))
    binShift = rightEdge + baseUnit - leftEdge
  }
  const looseShift = PASTE_OFFSET * pasteCount

  return place(content, { x: binShift, y: 0 }, { x: looseShift, y: looseShift }, nameFor, newId)
}

interface Shift {
  x: number
  y: number
}

/** New bins and shapes from `content`, moved by the given amounts. */
function place(
  content: ClipboardContent,
  binShift: Shift,
  looseShift: Shift,
  nameFor: (name: unknown) => string | undefined,
  newId: () => string
): PastePlan {
  const newGroupId = new Map<string, string>()
  const groups = content.groups.map((group) => {
    const id = newId()
    newGroupId.set(group.id, id)
    const metadata = renamed(group.metadata, nameFor(group.metadata?.name))
    return {
      ...structuredClone(group),
      id,
      x: group.x + binShift.x,
      y: group.y + binShift.y,
      childIds: [],
      metadata
    }
  })

  const shapeGroup = new Map<string, string>()
  const shapes = content.shapes.map((shape) => {
    const id = newId()
    const groupId = shape.groupId === null ? undefined : newGroupId.get(shape.groupId)
    if (groupId) shapeGroup.set(id, groupId)
    // A shape pasted along with its bin keeps its name. One pasted beside the original gets
    // a name that tells them apart.
    const keptName = typeof shape.metadata?.name === 'string' ? shape.metadata.name : undefined
    const metadata = renamed(shape.metadata, groupId ? keptName : nameFor(keptName))
    const shift = groupId ? binShift : looseShift
    return {
      ...structuredClone(shape),
      id,
      x: shape.x + shift.x,
      y: shape.y + shift.y,
      groupId: null,
      metadata
    }
  })

  return { groups, shapes, shapeGroup }
}

/**
 * Where "Paste here" puts things: the middle of what was copied goes to `point`, and
 * everything keeps its arrangement. Copied bins move by whole grid squares, so they stay on
 * the grid. Null when a pasted bin would land on a bin that is already there.
 *
 * `asCopy` is false for the first paste after a cut, which keeps the names.
 */
export function planPasteAt(
  content: ClipboardContent,
  existingGroups: LayoutGroup[],
  baseUnit: number,
  point: { x: number; y: number },
  asCopy: boolean,
  newId: () => string
): PastePlan | null {
  // The box around the copied bins, and around the middles of the copied shapes.
  const xs = [
    ...content.groups.flatMap((g) => [g.x, g.x + g.width]),
    ...content.shapes.map((s) => s.x)
  ]
  const ys = [
    ...content.groups.flatMap((g) => [g.y - g.height, g.y]),
    ...content.shapes.map((s) => s.y)
  ]
  if (xs.length === 0) return null
  const middle = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2
  }
  const onGrid = (value: number): number =>
    content.groups.length > 0 ? Math.round(value / baseUnit) * baseUnit : value
  const shift = { x: onGrid(point.x - middle.x), y: onGrid(point.y - middle.y) }

  const nameFor = (name: unknown): string | undefined =>
    asCopy ? copyName(name) : typeof name === 'string' ? name : undefined
  const plan = place(content, shift, shift, nameFor, newId)
  const blocked = plan.groups.some((pasted) =>
    existingGroups.some((existing) => overlaps(pasted, existing))
  )
  return blocked ? null : plan
}
