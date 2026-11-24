/**
 * Selection in a list of rows, as file managers do it: a plain click picks one row,
 * Cmd or Ctrl adds or removes a row, and Shift picks everything from the last row
 * clicked to this one.
 */

export interface ListClick {
  /** Every row's id, in the order shown. */
  order: string[]
  /** What is selected now. */
  selected: string[]
  /** The row clicked. */
  clicked: string
  /** The row a Shift-click reaches back to: the last one clicked without Shift. */
  anchor: string | null
  shift: boolean
  /** Cmd on a Mac, Ctrl elsewhere. */
  toggle: boolean
}

export interface ListSelection {
  selected: string[]
  anchor: string | null
}

export function selectionAfterClick(click: ListClick): ListSelection {
  const { order, selected, clicked, shift, toggle } = click

  // The selection can change on the canvas between clicks. A row that is no longer selected
  // is not where the person last was, so reach back to the last selected row instead.
  const stillSelected = click.anchor !== null && selected.includes(click.anchor)
  const anchor = stillSelected
    ? click.anchor
    : (selected.filter((id) => order.includes(id)).at(-1) ?? null)

  if (shift) {
    const from = anchor === null ? -1 : order.indexOf(anchor)
    const to = order.indexOf(clicked)
    // With nothing to reach back to, a Shift-click is a plain click.
    if (from === -1 || to === -1) return { selected: [clicked], anchor: clicked }
    const range = order.slice(Math.min(from, to), Math.max(from, to) + 1)
    // With Cmd or Ctrl as well, the range is added to what is already selected.
    const kept = toggle ? selected.filter((id) => !range.includes(id)) : []
    return { selected: [...kept, ...range], anchor }
  }

  if (toggle) {
    return {
      selected: selected.includes(clicked)
        ? selected.filter((id) => id !== clicked)
        : [...selected, clicked],
      anchor: clicked
    }
  }

  return { selected: [clicked], anchor: clicked }
}
