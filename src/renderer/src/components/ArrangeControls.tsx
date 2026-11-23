import { Button } from '@unstable-studios/ui'
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

const DISTRIBUTE_ACTIONS: Array<{ axis: DistributeAxis; label: string; icon: LucideIcon }> = [
  { axis: 'horizontal', label: 'Distribute horizontally', icon: AlignHorizontalSpaceAround },
  { axis: 'vertical', label: 'Distribute vertically', icon: AlignVerticalSpaceAround }
]

const IN_BIN_LABELS: Partial<Record<AlignMode, string>> = {
  centerX: 'Center horizontally in bin',
  centerY: 'Center vertically in bin'
}

/**
 * Align buttons for the current selection. `target` decides which buttons
 * show. Each click measures the shapes again, since a shape can move without
 * this component rendering.
 */
export default function ArrangeControls({
  engine,
  selectedIds,
  target
}: {
  engine: LayoutEngine
  selectedIds: string[]
  target: ArrangeTarget
}): React.JSX.Element {
  const inBin = target.frame !== undefined

  const align = (mode: AlignMode): void => {
    const current = arrangeTarget(engine, selectedIds)
    if (!current?.modes.includes(mode)) return
    engine.translateShapes(alignMoves(current.boxes, mode, current.frame))
  }

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Align" className="grid grid-cols-6 gap-1">
        {ALIGN_ACTIONS.filter(({ mode }) => target.modes.includes(mode)).map(
          ({ mode, label, icon: Icon }) => {
            const name = (inBin && IN_BIN_LABELS[mode]) || label
            return (
              <Button
                key={mode}
                variant="outline"
                size="icon-sm"
                className="w-full"
                aria-label={name}
                title={name}
                onClick={() => align(mode)}
              >
                <Icon aria-hidden />
              </Button>
            )
          }
        )}
      </div>
      {!inBin && (
        <div role="group" aria-label="Distribute" className="grid grid-cols-6 gap-1">
          {DISTRIBUTE_ACTIONS.map(({ axis, label, icon: Icon }) => (
            <Button
              key={axis}
              variant="outline"
              size="icon-sm"
              className="w-full"
              aria-label={label}
              title={target.canDistribute ? label : `${label} (select 3 or more)`}
              disabled={!target.canDistribute}
              onClick={() => engine.translateShapes(distributeMoves(target.boxes, axis))}
            >
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
