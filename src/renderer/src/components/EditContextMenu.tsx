import { useRef } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useEditCommands } from '@/hooks/useEditCommands'

interface EditContextMenuProps {
  /** One element. A right-click anywhere on it opens the menu. */
  children: React.ReactElement
  /** Leave right-clicks alone, as while a drawing tool is in use. */
  disabled?: boolean
}

/**
 * The right-click menu for bins and shapes, on the canvas and in the sidebar lists. It acts
 * on the selection, so whatever it wraps selects the item under the pointer before it opens.
 */
export default function EditContextMenu({
  children,
  disabled = false
}: EditContextMenuProps): React.JSX.Element {
  const edit = useEditCommands()
  // Rename puts the keyboard in a text field. The closing menu would take it straight back,
  // so the rename starts once the menu has closed.
  const afterClose = useRef<(() => void) | null>(null)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-40"
        onCloseAutoFocus={(e) => {
          // Leave the keyboard where it is instead of sending it to the canvas or list.
          e.preventDefault()
          const run = afterClose.current
          afterClose.current = null
          run?.()
        }}
      >
        <ContextMenuItem
          disabled={!edit.canRename}
          onSelect={() => {
            afterClose.current = edit.rename
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!edit.canCopy} onSelect={edit.cut}>
          Cut
        </ContextMenuItem>
        <ContextMenuItem disabled={!edit.canCopy} onSelect={edit.copy}>
          Copy
        </ContextMenuItem>
        <ContextMenuItem disabled={!edit.canPaste} onSelect={edit.paste}>
          Paste
        </ContextMenuItem>
        <ContextMenuItem disabled={!edit.canCopy} onSelect={edit.duplicate}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!edit.canSelectAll} onSelect={edit.selectAll}>
          Select all
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={!edit.canCopy} onSelect={edit.remove}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
