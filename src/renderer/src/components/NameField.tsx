import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { MAX_NAME_LENGTH, nameToStore } from '@/lib/item-name'

interface NameFieldProps {
  /** The current name. */
  value: string
  /** Called with the new name when the person finishes typing a different, non-empty one. */
  onRename: (name: string) => void
  /** Called when editing ends, whether or not the name changed. */
  onDone?: () => void
  /** Focus the field and select its text as soon as it appears. */
  autoFocus?: boolean
  'aria-label': string
  className?: string
}

/**
 * A text field for the name of a bin or shape. Enter or leaving the field keeps what was
 * typed, Esc puts the old name back. The name is stored once, when editing ends, so a rename
 * is one undo step.
 */
export default function NameField({
  value,
  onRename,
  onDone,
  autoFocus = false,
  className,
  ...props
}: NameFieldProps): React.JSX.Element {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  // Esc blurs the field, and that blur must not store what was typed.
  const cancelledRef = useRef(false)

  // Follow the name when it changes from outside: undo, or another item being selected.
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(value)
  }

  useEffect(() => {
    if (!autoFocus) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [autoFocus])

  const finish = (): void => {
    if (cancelledRef.current) {
      cancelledRef.current = false
    } else {
      const name = nameToStore(text, value)
      if (name === null) setText(value)
      else onRename(name)
    }
    onDone?.()
  }

  // A field can go away while it still has the keyboard: the selection changes, or the panel
  // it is in closes. That gives no blur, so what was typed is kept here instead.
  // `onDone` is not called: React also runs this once when the field first appears in
  // development, and closing an in-place rename then would end it before it began.
  const latest = useRef({ text, value, onRename })
  useEffect(() => {
    latest.current = { text, value, onRename }
  })
  useEffect(() => {
    const input = inputRef.current
    return () => {
      if (document.activeElement !== input || cancelledRef.current) return
      const { text: typed, value: current, onRename: rename } = latest.current
      const name = nameToStore(typed, current)
      if (name !== null) rename(name)
    }
  }, [])

  return (
    <Input
      ref={inputRef}
      type="text"
      value={text}
      maxLength={MAX_NAME_LENGTH}
      spellCheck={false}
      className={className}
      onChange={(e) => setText(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        // Enter that confirms a choice in an input method is not the end of the name.
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          cancelledRef.current = true
          setText(value)
          e.currentTarget.blur()
        }
      }}
      {...props}
    />
  )
}
