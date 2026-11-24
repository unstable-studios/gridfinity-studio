import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { useLayoutEngine, useEngineState } from '@/layout-engine'
import { findContainingBinGroup } from '@/layout-engine/containment'
import { copySelection, planPaste, type ClipboardContent } from '@/lib/clipboard'
import { removeItems } from '@/lib/remove-items'
import { useAppMode } from './useAppMode'
import { useProject } from './useProject'

interface ClipboardState {
  content: ClipboardContent | null
  /** How many paste offsets the next paste of loose shapes is moved by. */
  nextOffset: number
}

/** What was last cut or copied. Kept in the app, not on the system clipboard. */
const useClipboard = create<ClipboardState>(() => ({ content: null, nextOffset: 0 }))

export interface EditCommands {
  /** Something is selected, so it can be cut, copied, duplicated or deleted. */
  canCopy: boolean
  canPaste: boolean
  canSelectAll: boolean
  /** Exactly one bin or shape is selected. */
  canRename: boolean
  copy: () => void
  cut: () => void
  paste: () => void
  /** Paste a copy of the selection without changing what is on the clipboard. */
  duplicate: () => void
  remove: () => void
  /** Start typing a new name for the selected bin or shape, in the sidebar list. */
  rename: () => void
  selectAll: () => void
}

/** The row in the sidebar lists whose name is being typed, if any. */
export const useRenaming = create<{ id: string | null }>(() => ({ id: null }))

/** Whether a key press belongs to a text field and must be left to it. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * Cut, copy, paste and the other edit commands for bins and shapes. They work in Design
 * only. Use `useEditShortcuts` in the one place that should also listen for the keys.
 */
export function useEditCommands(): EditCommands {
  const engine = useLayoutEngine()
  const { selectedIds, tick } = useEngineState()
  const { mode } = useAppMode()
  const baseUnit = useProject((s) => s.project?.gridfinity.baseUnit ?? 42)
  const hasContent = useClipboard((s) => s.content !== null)
  // What was copied belongs to the project it came from. Another project can have a
  // different grid, where a pasted bin would not fit.
  const projectKey = useProject((s) => s.project?.settings.createdAt)
  useEffect(() => {
    useClipboard.setState({ content: null, nextOffset: 0 })
  }, [projectKey])
  const designing = mode === 'layout' && engine !== null

  const copyToClipboard = useCallback(
    (nextOffset: number): ClipboardContent | null => {
      if (!engine) return null
      const content = copySelection(
        engine.getAllGroups(),
        engine.getAllShapes(),
        engine.getSelectedIds()
      )
      if (content) useClipboard.setState({ content, nextOffset })
      return content
    },
    [engine]
  )

  // A copy is pasted beside the original. A cut is pasted where it was.
  const copy = useCallback(() => void copyToClipboard(1), [copyToClipboard])

  const cut = useCallback(() => {
    if (!engine) return
    const selected = engine.getSelectedIds()
    if (copyToClipboard(0)) removeItems(engine, selected)
  }, [engine, copyToClipboard])

  const pasteContent = useCallback(
    (content: ClipboardContent, offset: number): void => {
      if (!engine) return
      const plan = planPaste(content, engine.getAllGroups(), baseUnit, offset, () =>
        crypto.randomUUID()
      )
      const pasted: string[] = plan.groups.map((g) => g.id)
      engine.batch(() => {
        for (const group of plan.groups) engine.createGroup(group)
        for (const shape of plan.shapes) {
          engine.addShape(shape)
          let groupId = plan.shapeGroup.get(shape.id)
          if (!groupId) {
            // A shape pasted on its own joins the bin its center lands in, the same rule a
            // dragged shape follows.
            pasted.push(shape.id)
            const bounds = engine.getShapeBounds(shape.id)
            groupId = bounds
              ? findContainingBinGroup(
                  engine.getAllGroups(),
                  (bounds.minX + bounds.maxX) / 2,
                  (bounds.minY + bounds.maxY) / 2
                )?.id
              : undefined
          }
          if (groupId) engine.addToGroup(shape.id, groupId)
        }
      })
      engine.select(pasted)
    },
    [engine, baseUnit]
  )

  const paste = useCallback(() => {
    const { content, nextOffset } = useClipboard.getState()
    if (!content) return
    pasteContent(content, nextOffset)
    useClipboard.setState({ nextOffset: nextOffset + 1 })
  }, [pasteContent])

  const duplicate = useCallback(() => {
    if (!engine) return
    const content = copySelection(
      engine.getAllGroups(),
      engine.getAllShapes(),
      engine.getSelectedIds()
    )
    if (content) pasteContent(content, 1)
  }, [engine, pasteContent])

  const remove = useCallback(() => {
    if (engine) removeItems(engine, engine.getSelectedIds())
  }, [engine])

  const rename = useCallback(() => {
    const ids = engine?.getSelectedIds() ?? []
    if (ids.length === 1) useRenaming.setState({ id: ids[0] })
  }, [engine])

  const selectAll = useCallback(() => {
    if (!engine) return
    // Shapes in a bin come along with it, so they are not selected a second time.
    const loose = engine.getAllShapes().filter((s) => s.groupId === null)
    engine.select([...engine.getAllGroups().map((g) => g.id), ...loose.map((s) => s.id)])
  }, [engine])

  // `tick` is read so this is worked out again after every change to the canvas.
  void tick
  const canSelectAll =
    designing && (engine.getAllGroups().length > 0 || engine.getAllShapes().length > 0)
  const canCopy = designing && selectedIds.length > 0
  const canPaste = designing && hasContent
  const canRename = designing && selectedIds.length === 1

  return {
    canCopy,
    canPaste,
    canSelectAll,
    canRename,
    copy,
    cut,
    paste,
    duplicate,
    remove,
    rename,
    selectAll
  }
}

/**
 * The edit commands, plus their keyboard shortcuts. Mount this once: two would run every
 * shortcut twice.
 */
export function useEditShortcuts(): EditCommands {
  const commands = useEditCommands()
  const engine = useLayoutEngine()
  const { mode } = useAppMode()
  const designing = mode === 'layout' && engine !== null
  const { copy, cut, paste, selectAll } = commands

  useEffect(() => {
    if (!designing) return
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (isTyping(e.target)) return
      // With a dialog open, the canvas behind it is out of reach.
      if (document.querySelector('[role="dialog"]')) return
      // Text selected on the page is what the person means to copy.
      if (e.code === 'KeyC' && !window.getSelection()?.isCollapsed) return
      const commands: Record<string, [enabled: boolean, run: () => void]> = {
        KeyC: [engine.getSelectedIds().length > 0, copy],
        KeyX: [engine.getSelectedIds().length > 0, cut],
        KeyV: [useClipboard.getState().content !== null, paste],
        KeyA: [true, selectAll]
      }
      const command = commands[e.code]
      // With nothing to act on, the key keeps its usual meaning, such as copying selected text.
      if (!command || !command[0]) return
      e.preventDefault()
      command[1]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [designing, engine, copy, cut, paste, selectAll])

  return commands
}
