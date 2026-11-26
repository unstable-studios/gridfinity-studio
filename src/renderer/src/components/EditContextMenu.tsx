import { useRef } from 'react'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useEditCommands } from '@/hooks/useEditCommands'
import { useProject } from '@/hooks/useProject'
import { useEngineState, useLayoutEngine } from '@/layout-engine'
import { arrangeTarget } from '@/layout-engine/arrange-target'
import {
  DISTRIBUTE_ACTIONS,
  alignActionsFor,
  alignSelection,
  distributeSelection
} from '@/lib/arrange-commands'
import { binFromDrag, binOverlaps } from '@/lib/draw-bin'
import type { Point } from '@/lib/draw-box'
import { menuTarget, placeBeside } from '@/lib/menu-target'
import { addBin } from '@/lib/new-bin'
import { updateBin } from '@/lib/bin-update'
import { depthChoices, movesIntoBin, movesOutOfBins, sizeSteps } from '@/lib/menu-actions'
import { withPocketDepth } from '@/lib/pocket-depth'
import { storedName } from '@/lib/item-name'
import { useAppMode } from '@/hooks/useAppMode'
import { exportOnly } from '@/hooks/useExport'
import { isBinGroup } from '@/layout-engine/types'
import type { ShapeAABB } from '@/layout-engine/containment'
import {
  DEFAULT_GRIDFINITY_CONFIG,
  computeDefaultPocketDepth,
  newBinDefaults
} from '../../../shared/types/project'

interface EditContextMenuProps {
  /** One element. A right-click anywhere on it opens the menu. */
  children: React.ReactElement
  /** Leave right-clicks alone, as while a drawing tool is in use. */
  disabled?: boolean
  /**
   * Where on the canvas the right-click was, in world units. Given by the canvas only: the
   * sidebar lists have no place to add a bin at.
   */
  canvasPoint?: Point | null
}

/**
 * The right-click menu for bins and shapes, on the canvas and in the sidebar lists. It acts
 * on the selection, so whatever it wraps selects the item under the pointer before it opens,
 * and what it offers depends on that: a bin, shapes, or empty canvas.
 */
export default function EditContextMenu({
  children,
  disabled = false,
  canvasPoint
}: EditContextMenuProps): React.JSX.Element {
  // Rename puts the keyboard in a text field. The closing menu would take it straight back,
  // so the rename starts once the menu has closed.
  const afterClose = useRef<(() => void) | null>(null)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        // No closing animation: while it played, the menu still took keys and clicks, so a
        // quick second click ran an item twice.
        className="min-w-44 data-[state=closed]:animate-none"
        onCloseAutoFocus={(e) => {
          const run = afterClose.current
          afterClose.current = null
          if (!run) return
          // Otherwise the keyboard goes back to where the menu was opened from.
          e.preventDefault()
          run()
        }}
      >
        <MenuItems
          canvasPoint={canvasPoint}
          afterClose={(run) => {
            afterClose.current = run
          }}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The items, for what is selected now. Its own component so that it exists only while the
 * menu is open: it measures the layout, which must not happen on every pan and zoom.
 */
function MenuItems({
  canvasPoint,
  afterClose
}: {
  canvasPoint?: Point | null
  /**
   * Run something once the menu has closed, in place of the keyboard going back to where
   * the menu was opened from. For what puts the keyboard somewhere itself, or opens
   * something that would close again when the keyboard moved.
   */
  afterClose: (run: () => void) => void
}): React.JSX.Element {
  const edit = useEditCommands()
  const engine = useLayoutEngine()
  const { selectedIds } = useEngineState()
  const gridfinity = useProject((s) => s.project?.gridfinity) ?? DEFAULT_GRIDFINITY_CONFIG
  const { setMode, setActiveTool } = useAppMode()

  const groups = engine?.getAllGroups() ?? []
  const target = menuTarget(groups, selectedIds)
  const hasSelection = target.kind !== 'none'
  const arrange = engine && target.kind === 'shapes' ? arrangeTarget(engine, selectedIds) : null

  // On empty canvas: a 1×1 bin in the grid square under the pointer, if it is free.
  const cell = engine?.getGridConfig().size ?? gridfinity.baseUnit
  const binHere =
    target.kind === 'none' && canvasPoint ? binFromDrag(canvasPoint, canvasPoint, cell) : null
  // Beside a bin: an empty one the same size and height.
  const beside = target.kind === 'bin' ? placeBeside(target.bin, groups) : null

  // Pockets: the selected shapes that are in a bin, each with its bin and how deep that
  // bin lets a pocket go.
  const bins = groups.filter(isBinGroup)
  const pockets =
    engine && target.kind === 'shapes'
      ? selectedIds.flatMap((id) => {
          const shape = engine.getShape(id)
          const bin = bins.find((candidate) => candidate.id === shape?.groupId)
          if (!shape || !bin) return []
          const maxDepth = computeDefaultPocketDepth(
            bin.metadata.heightUnits,
            gridfinity.unitHeight
          )
          return [{ shape, bin, maxDepth }]
        })
      : []
  // The depths are named with their millimeters when every pocket would get the same ones.
  const sameDepths = new Set(pockets.map((pocket) => pocket.maxDepth)).size === 1
  const depths = pockets.length > 0 ? depthChoices(pockets[0].maxDepth) : []
  const setDepth = (choice: number): void => {
    engine?.batch(() => {
      for (const { shape, maxDepth } of pockets) {
        const { depth } = depthChoices(maxDepth)[choice]
        engine.updateShape(shape.id, { metadata: withPocketDepth(shape.metadata, depth) })
      }
    })
  }

  /** Where the selected shapes are on the canvas, for moving them as they are arranged. */
  const boxes = (ids: string[]): Array<ShapeAABB & { id: string }> =>
    ids.flatMap((id) => {
      const bounds = engine?.getShapeBounds(id)
      return bounds ? [{ id, ...bounds }] : []
    })
  // A bin every selected shape is already in is not somewhere to move them to.
  const home =
    pockets.length > 0 &&
    pockets.length === selectedIds.length &&
    pockets.every((pocket) => pocket.bin.id === pockets[0].bin.id)
      ? pockets[0].bin.id
      : null
  const otherBins = target.kind === 'shapes' ? bins.filter((bin) => bin.id !== home) : []

  return (
    <>
      {binHere && (
        <>
          <ContextMenuItem
            disabled={!engine || binOverlaps(groups, binHere)}
            onSelect={() => {
              // Like a bin drawn with the Bin tool, it takes in a loose shape it lands on.
              if (engine) {
                addBin(engine, binHere, cell, newBinDefaults(gridfinity), { adoptShapes: true })
              }
            }}
          >
            Add bin here
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canvasPoint || !edit.canPaste || !edit.canPasteAt(canvasPoint)}
            onSelect={() => {
              if (canvasPoint) edit.pasteAt(canvasPoint)
            }}
          >
            Paste here
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}

      {hasSelection && (
        <ContextMenuItem disabled={!edit.canRename} onSelect={() => afterClose(edit.rename)}>
          Rename
        </ContextMenuItem>
      )}

      {target.kind === 'bin' && (
        <>
          <ContextMenuCheckboxItem
            checked={target.bin.metadata.hasLip}
            onCheckedChange={(checked) => {
              engine?.updateGroup(target.bin.id, {
                metadata: { ...target.bin.metadata, hasLip: checked === true }
              })
            }}
          >
            Stacking lip
          </ContextMenuCheckboxItem>
          <ContextMenuItem
            disabled={!engine || !beside}
            onSelect={() => {
              if (!engine || !beside) return
              const { heightUnits, hasLip } = target.bin.metadata
              addBin(engine, beside, cell, { heightUnits, hasLip }, { adoptShapes: true })
            }}
          >
            Add bin beside
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Size</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {sizeSteps(target.bin.metadata).map(({ label, patch, enabled }) => (
                <ContextMenuItem
                  key={label}
                  disabled={!engine || !enabled}
                  onSelect={() => {
                    if (engine) updateBin(engine, target.bin.id, patch, cell)
                  }}
                >
                  {label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onSelect={() => {
              const binId = target.bin.id
              // Preview opens with only this bin checked and Export showing. After the menu
              // has closed, or the keyboard going back to the canvas would close Export.
              afterClose(() => {
                exportOnly(binId)
                setMode('review')
                setActiveTool(null)
              })
            }}
          >
            Export this bin…
          </ContextMenuItem>
        </>
      )}

      {pockets.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Depth</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {depths.map(({ label }, choice) => (
              <ContextMenuItem key={label} onSelect={() => setDepth(choice)}>
                {sameDepths ? label : label.replace(/ \(.*\)$/, '')}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {engine && otherBins.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to bin</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {otherBins.map((bin) => (
              <ContextMenuItem
                key={bin.id}
                onSelect={() => engine.translateShapes(movesIntoBin(boxes(selectedIds), bin))}
              >
                {storedName(bin.metadata) ?? 'Bin'}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {engine && pockets.length > 0 && (
        <ContextMenuItem
          onSelect={() =>
            engine.translateShapes(
              movesOutOfBins(boxes(pockets.map((pocket) => pocket.shape.id)), bins)
            )
          }
        >
          Take out of bin
        </ContextMenuItem>
      )}

      {engine && arrange && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Arrange</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-52">
            {alignActionsFor(arrange).map(({ mode, label, icon: Icon }) => (
              <ContextMenuItem
                key={mode}
                onSelect={() => alignSelection(engine, selectedIds, mode)}
              >
                <Icon aria-hidden />
                {label}
              </ContextMenuItem>
            ))}
            {arrange.canDistribute && (
              <>
                <ContextMenuSeparator />
                {DISTRIBUTE_ACTIONS.map(({ axis, label, icon: Icon }) => (
                  <ContextMenuItem
                    key={axis}
                    onSelect={() => distributeSelection(engine, selectedIds, axis)}
                  >
                    <Icon aria-hidden />
                    {label}
                  </ContextMenuItem>
                ))}
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {hasSelection && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={edit.cut}>Cut</ContextMenuItem>
          <ContextMenuItem onSelect={edit.copy}>Copy</ContextMenuItem>
        </>
      )}
      <ContextMenuItem disabled={!edit.canPaste} onSelect={edit.paste}>
        Paste
      </ContextMenuItem>
      {hasSelection && <ContextMenuItem onSelect={edit.duplicate}>Duplicate</ContextMenuItem>}
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!edit.canSelectAll} onSelect={edit.selectAll}>
        Select all
      </ContextMenuItem>
      {canvasPoint && !hasSelection && (
        <ContextMenuItem onSelect={() => engine?.resetView()}>Reset view</ContextMenuItem>
      )}
      {hasSelection && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={edit.remove}>
            Delete
          </ContextMenuItem>
        </>
      )}
    </>
  )
}
