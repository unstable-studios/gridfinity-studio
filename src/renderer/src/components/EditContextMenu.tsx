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
import { DEFAULT_GRIDFINITY_CONFIG, newBinDefaults } from '../../../shared/types/project'

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
  const edit = useEditCommands()
  const engine = useLayoutEngine()
  const { selectedIds } = useEngineState()
  const gridfinity = useProject((s) => s.project?.gridfinity) ?? DEFAULT_GRIDFINITY_CONFIG
  // Rename puts the keyboard in a text field. The closing menu would take it straight back,
  // so the rename starts once the menu has closed.
  const afterClose = useRef<(() => void) | null>(null)

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
        {binHere && (
          <>
            <ContextMenuItem
              disabled={!engine || binOverlaps(groups, binHere)}
              onSelect={() => {
                if (engine) addBin(engine, binHere, cell, newBinDefaults(gridfinity))
              }}
            >
              Add bin here
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {hasSelection && (
          <ContextMenuItem
            disabled={!edit.canRename}
            onSelect={() => {
              afterClose.current = edit.rename
            }}
          >
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
                addBin(engine, beside, cell, { heightUnits, hasLip })
              }}
            >
              Add bin beside
            </ContextMenuItem>
          </>
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
      </ContextMenuContent>
    </ContextMenu>
  )
}
