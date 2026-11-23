import { Button } from '@unstable-studios/ui'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LayoutEngine } from '@/layout-engine'
import { alignMoves } from '@/layout-engine/arrange'
import type { AlignMode } from '@/layout-engine/arrange'
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
    </div>
  )
}
