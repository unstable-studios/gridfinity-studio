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

/** "Bin 1" becomes "Bin 1 copy". A name that already says so is left alone. */
function copyName(name: unknown): string | undefined {
  if (typeof name !== 'string' || name === '') return undefined
  return / copy$/.test(name) ? name : `${name} copy`
}

/**
 * Where a paste puts things.
 *
 * Bins keep their arrangement and go to the right of every bin on the canvas, one grid unit
 * clear, so a pasted bin never lands on another. Shapes copied on their own land a little
 * down and to the right of where they were, further with each paste of the same copy.
 */
export function planPaste(
  content: ClipboardContent,
  existingGroups: LayoutGroup[],
  baseUnit: number,
  pasteCount: number,
  newId: () => string
): PastePlan {
  let binShift = 0
  if (content.groups.length > 0 && existingGroups.length > 0) {
    const rightEdge = Math.max(...existingGroups.map((g) => g.x + g.width))
    const leftEdge = Math.min(...content.groups.map((g) => g.x))
    binShift = rightEdge + baseUnit - leftEdge
  }
  const looseShift = PASTE_OFFSET * pasteCount

  const newGroupId = new Map<string, string>()
  const groups = content.groups.map((group) => {
    const id = newId()
    newGroupId.set(group.id, id)
    const metadata = group.metadata
      ? { ...structuredClone(group.metadata), name: copyName(group.metadata.name) }
      : undefined
    return { ...structuredClone(group), id, x: group.x + binShift, childIds: [], metadata }
  })

  const shapeGroup = new Map<string, string>()
  const shapes = content.shapes.map((shape) => {
    const id = newId()
    const groupId = shape.groupId === null ? undefined : newGroupId.get(shape.groupId)
    if (groupId) shapeGroup.set(id, groupId)
    const metadata = shape.metadata
      ? {
          ...structuredClone(shape.metadata),
          // A shape pasted along with its bin keeps its name. One pasted beside the original
          // gets a name that tells them apart.
          name: groupId ? shape.metadata.name : copyName(shape.metadata.name)
        }
      : undefined
    return {
      ...structuredClone(shape),
      id,
      x: shape.x + (groupId ? binShift : looseShift),
      y: shape.y + (groupId ? 0 : looseShift),
      groupId: null,
      metadata
    }
  })

  return { groups, shapes, shapeGroup }
}
