/**
 * Align and distribute, as the sidebar's buttons and the right-click menu both offer them.
 * Each command measures the shapes again when it runs, since a shape can move without the
 * component that offered the command rendering.
 */
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LayoutEngine } from '@/layout-engine'
import { alignMoves, distributeMoves } from '@/layout-engine/arrange'
import type { AlignMode, DistributeAxis } from '@/layout-engine/arrange'
import { arrangeTarget } from '@/layout-engine/arrange-target'
import type { ArrangeTarget } from '@/layout-engine/arrange-target'

const ALIGN_ACTIONS: Array<{ mode: AlignMode; label: string; icon: LucideIcon }> = [
  { mode: 'left', label: 'Align left', icon: AlignStartVertical },
  { mode: 'centerX', label: 'Align horizontal centers', icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right', icon: AlignEndVertical },
  { mode: 'top', label: 'Align top', icon: AlignStartHorizontal },
  { mode: 'centerY', label: 'Align vertical centers', icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal }
]

export const DISTRIBUTE_ACTIONS: Array<{ axis: DistributeAxis; label: string; icon: LucideIcon }> =
  [
    { axis: 'horizontal', label: 'Distribute horizontally', icon: AlignHorizontalSpaceAround },
    { axis: 'vertical', label: 'Distribute vertically', icon: AlignVerticalSpaceAround }
  ]

const IN_BIN_LABELS: Partial<Record<AlignMode, string>> = {
  centerX: 'Center horizontally in bin',
  centerY: 'Center vertically in bin'
}

/** The align commands `target` allows, named for what they align to. */
export function alignActionsFor(
  target: ArrangeTarget
): Array<{ mode: AlignMode; label: string; icon: LucideIcon }> {
  const inBin = target.frame !== undefined
  return ALIGN_ACTIONS.filter(({ mode }) => target.modes.includes(mode)).map((action) => ({
    ...action,
    label: (inBin && IN_BIN_LABELS[action.mode]) || action.label
  }))
}

export function alignSelection(engine: LayoutEngine, selectedIds: string[], mode: AlignMode): void {
  const current = arrangeTarget(engine, selectedIds)
  if (!current?.modes.includes(mode)) return
  engine.translateShapes(alignMoves(current.boxes, mode, current.frame))
}

export function distributeSelection(
  engine: LayoutEngine,
  selectedIds: string[],
  axis: DistributeAxis
): void {
  const current = arrangeTarget(engine, selectedIds)
  if (!current?.canDistribute) return
  engine.translateShapes(distributeMoves(current.boxes, axis))
}
