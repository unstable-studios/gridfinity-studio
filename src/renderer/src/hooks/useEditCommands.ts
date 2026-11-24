import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { useLayoutEngine, useEngineState } from '@/layout-engine'
import { findBestBinForShape } from '@/layout-engine/containment'
import { copySelection, planPaste, type ClipboardContent } from '@/lib/clipboard'
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
  canCopy: boolean
  canPaste: boolean
  canSelectAll: boolean
  copy: () => void
  cut: () => void
  paste: () => void
  selectAll: () => void
}

/** Whether a key press belongs to a text field and must be left to it. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * Cut, copy, paste and select all for bins and shapes, with their keyboard shortcuts. They
 * work in Design only. Mount this once.
 */
export function useEditCommands(): EditCommands {
  const engine = useLayoutEngine()
  const { selectedIds, tick } = useEngineState()
  const { mode } = useAppMode()
  const baseUnit = useProject((s) => s.project?.gridfinity.baseUnit ?? 42)
  const hasContent = useClipboard((s) => s.content !== null)
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
    const selected = new Set(engine.getSelectedIds())
    if (!copyToClipboard(0)) return
    const shapes = engine.getAllShapes()
    engine.clearSelection()
    engine.batch(() => {
      // A bin goes with what is in it. Removing only the bin would leave its shapes behind.
      for (const shape of shapes) {
        const inCutBin = shape.groupId !== null && selected.has(shape.groupId)
        if (inCutBin || selected.has(shape.id)) engine.removeShape(shape.id)
      }
      for (const id of selected) {
        if (engine.getGroup(id)) engine.removeGroup(id)
      }
    })
  }, [engine, copyToClipboard])

  const paste = useCallback(() => {
    const { content, nextOffset } = useClipboard.getState()
    if (!engine || !content) return
    const plan = planPaste(content, engine.getAllGroups(), baseUnit, nextOffset, () =>
      crypto.randomUUID()
    )
    const pasted: string[] = plan.groups.map((g) => g.id)
    engine.batch(() => {
      for (const group of plan.groups) engine.createGroup(group)
      for (const shape of plan.shapes) {
        engine.addShape(shape)
        let groupId = plan.shapeGroup.get(shape.id)
        if (!groupId) {
          // A shape pasted on its own joins whichever bin it lands in.
          pasted.push(shape.id)
          const bounds = engine.getShapeBounds(shape.id)
          groupId = bounds ? findBestBinForShape(engine.getAllGroups(), bounds)?.id : undefined
        }
        if (groupId) engine.addToGroup(shape.id, groupId)
      }
    })
    engine.select(pasted)
    useClipboard.setState({ nextOffset: nextOffset + 1 })
  }, [engine, baseUnit])

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

  useEffect(() => {
    if (!designing) return
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (isTyping(e.target)) return
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

  return { canCopy, canPaste, canSelectAll, copy, cut, paste, selectAll }
}
