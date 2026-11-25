import { Button } from '@unstable-studios/ui'
import type { LayoutEngine } from '@/layout-engine'
import type { ArrangeTarget } from '@/layout-engine/arrange-target'
import {
  DISTRIBUTE_ACTIONS,
  alignActionsFor,
  alignSelection,
  distributeSelection
} from '@/lib/arrange-commands'

/** Align and distribute buttons for the current selection. `target` decides which show. */
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

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Align" className="grid grid-cols-6 gap-1">
        {alignActionsFor(target).map(({ mode, label, icon: Icon }) => (
          <Button
            key={mode}
            variant="outline"
            size="icon-sm"
            className="w-full"
            aria-label={label}
            title={label}
            onClick={() => alignSelection(engine, selectedIds, mode)}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
      {target.canDistribute && (
        <div role="group" aria-label="Distribute" className="grid grid-cols-6 gap-1">
          {DISTRIBUTE_ACTIONS.map(({ axis, label, icon: Icon }) => (
            <Button
              key={axis}
              variant="outline"
              size="icon-sm"
              className="w-full"
              aria-label={label}
              title={label}
              onClick={() => distributeSelection(engine, selectedIds, axis)}
            >
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      )}
      {!inBin && !target.canDistribute && (
        <p className="text-[11px] text-zinc-500">Select 3 or more to distribute.</p>
      )}
    </div>
  )
}
