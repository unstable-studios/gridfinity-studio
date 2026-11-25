/**
 * What the right-click menu's commands do to a bin or to pockets, worked out on plain data.
 * `EditContextMenu` offers them and applies the result to the layout engine.
 */
import type { ShapeMove } from '@/layout-engine/arrange'
import type { ShapeAABB } from '@/layout-engine/containment'
import type { BinMetadata, LayoutGroup } from '@/layout-engine/types'
import { PASTE_OFFSET } from './clipboard'

export interface SizeStep {
  label: string
  /** What to change about the bin. */
  patch: Partial<BinMetadata>
  /** False when the bin is already as small as it gets that way. */
  enabled: boolean
}

/**
 * One grid unit more or less each way, and one height unit up or down. The ways along the
 * grid are named as columns and rows: "deeper" would read as how deep a pocket is cut.
 */
export function sizeSteps(bin: BinMetadata): SizeStep[] {
  const step = (label: string, key: 'widthUnits' | 'depthUnits' | 'heightUnits', by: number) => ({
    label,
    patch: { [key]: bin[key] + by },
    enabled: bin[key] + by >= 1
  })
  return [
    step('Add a column', 'widthUnits', 1),
    step('Remove a column', 'widthUnits', -1),
    step('Add a row', 'depthUnits', 1),
    step('Remove a row', 'depthUnits', -1),
    step('Taller', 'heightUnits', 1),
    step('Shorter', 'heightUnits', -1)
  ]
}

export interface DepthChoice {
  label: string
  /** In mm. Null cuts the pocket as deep as the bin allows, whatever its height becomes. */
  depth: number | null
}

/** Depths to pick from for a pocket in a bin that allows `maxDepth` mm. */
export function depthChoices(maxDepth: number): DepthChoice[] {
  const part = (share: number): number => Math.max(0.1, Math.round(maxDepth * share * 10) / 10)
  const mm = (depth: number): string => `${depth.toFixed(1)} mm`
  return [
    { label: `Full depth (${mm(maxDepth)})`, depth: null },
    { label: `Three quarters (${mm(part(0.75))})`, depth: part(0.75) },
    { label: `Half (${mm(part(0.5))})`, depth: part(0.5) },
    { label: `One quarter (${mm(part(0.25))})`, depth: part(0.25) }
  ]
}

type Box = ShapeAABB & { id: string }

/** The box around all of `boxes`. */
function around(boxes: Box[]): ShapeAABB {
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    maxY: Math.max(...boxes.map((box) => box.maxY))
  }
}

/**
 * Moves that put `boxes` in the middle of `bin`, arranged as they are. If together they are
 * wider or taller than the bin, each goes to the middle on its own instead: a shape belongs
 * to the bin its own middle is in, and arranged as they were some would land outside.
 */
export function movesIntoBin(boxes: Box[], bin: LayoutGroup): ShapeMove[] {
  if (boxes.length === 0) return []
  // A bin's x and y are its lower-left corner, and y grows downward.
  const middle = { x: bin.x + bin.width / 2, y: bin.y - bin.height / 2 }
  const to = (box: ShapeAABB): { dx: number; dy: number } => ({
    dx: middle.x - (box.minX + box.maxX) / 2,
    dy: middle.y - (box.minY + box.maxY) / 2
  })
  const all = around(boxes)
  const fits = all.maxX - all.minX <= bin.width && all.maxY - all.minY <= bin.height
  return boxes.map((box) => ({ id: box.id, ...to(fits ? all : box) }))
}

/**
 * Moves that take `boxes` out of every bin: straight to the right, to just past the last
 * bin, so they land on no bin whatever the layout.
 */
export function movesOutOfBins(boxes: Box[], bins: LayoutGroup[]): ShapeMove[] {
  if (boxes.length === 0 || bins.length === 0) return []
  const rightEdge = Math.max(...bins.map((bin) => bin.x + bin.width))
  const dx = rightEdge + PASTE_OFFSET - around(boxes).minX
  return boxes.map(({ id }) => ({ id, dx, dy: 0 }))
}
