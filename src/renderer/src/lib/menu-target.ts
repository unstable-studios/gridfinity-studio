/**
 * What a right-click menu is about, from the selection it acts on. The canvas selects what
 * is under the pointer before the menu opens, so the selection says what was clicked.
 */
import { isBinGroup } from '@/layout-engine/types'
import type { BinMetadata, LayoutGroup } from '@/layout-engine/types'
import type { DrawnBin } from './draw-bin'

export type Bin = LayoutGroup & { metadata: BinMetadata }

export type MenuTarget =
  /** Nothing selected: a right-click on empty canvas. */
  | { kind: 'none' }
  /** One bin, and nothing else. */
  | { kind: 'bin'; bin: Bin }
  /** Shapes only. */
  | { kind: 'shapes' }
  /** Several bins, or bins and shapes together. */
  | { kind: 'mixed' }

export function menuTarget(groups: LayoutGroup[], selectedIds: string[]): MenuTarget {
  if (selectedIds.length === 0) return { kind: 'none' }
  const selected = new Set(selectedIds)
  const bins = groups.filter((group) => selected.has(group.id)).filter(isBinGroup)
  if (bins.length === 0) return { kind: 'shapes' }
  if (bins.length === 1 && selectedIds.length === 1) return { kind: 'bin', bin: bins[0] }
  return { kind: 'mixed' }
}

/**
 * Where an empty bin the size of `bin` goes when added beside it: touching its right edge,
 * and if that is taken its left, top or bottom. Null when all four are taken.
 */
export function placeBeside(bin: Bin, groups: LayoutGroup[]): DrawnBin | null {
  const { width, height } = bin
  const { widthUnits, depthUnits } = bin.metadata
  const places = [
    { x: bin.x + width, y: bin.y },
    { x: bin.x - width, y: bin.y },
    { x: bin.x, y: bin.y - height },
    { x: bin.x, y: bin.y + height }
  ]
  // Two boxes that only share an edge do not overlap, so a hair is taken off each side.
  const hair = 1e-6
  const free = places.find((place) =>
    groups.every(
      (other) =>
        place.x + width - hair <= other.x ||
        other.x + other.width <= place.x + hair ||
        place.y - hair <= other.y - other.height ||
        other.y <= place.y - height + hair
    )
  )
  return free ? { ...free, width, height, widthUnits, depthUnits } : null
}
