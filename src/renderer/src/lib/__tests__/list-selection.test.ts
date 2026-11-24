import { describe, expect, it } from 'vitest'
import { selectionAfterClick } from '../list-selection'

const order = ['a', 'b', 'c', 'd', 'e']
const plain = { order, shift: false, toggle: false }

describe('selectionAfterClick', () => {
  it('selects only the clicked row on a plain click', () => {
    expect(
      selectionAfterClick({ ...plain, selected: ['a', 'b'], clicked: 'd', anchor: 'a' })
    ).toEqual({
      selected: ['d'],
      anchor: 'd'
    })
  })

  it('adds a row with Cmd or Ctrl', () => {
    const result = selectionAfterClick({
      ...plain,
      toggle: true,
      selected: ['a'],
      clicked: 'c',
      anchor: 'a'
    })

    expect(result).toEqual({ selected: ['a', 'c'], anchor: 'c' })
  })

  it('removes a selected row with Cmd or Ctrl', () => {
    const result = selectionAfterClick({
      ...plain,
      toggle: true,
      selected: ['a', 'c'],
      clicked: 'a',
      anchor: 'c'
    })

    expect(result).toEqual({ selected: ['c'], anchor: 'a' })
  })

  it('selects the range from the last clicked row with Shift', () => {
    const result = selectionAfterClick({
      ...plain,
      shift: true,
      selected: ['b'],
      clicked: 'd',
      anchor: 'b'
    })

    expect(result).toEqual({ selected: ['b', 'c', 'd'], anchor: 'b' })
  })

  it('selects a range upward, and keeps reaching back to the same row', () => {
    const down = selectionAfterClick({
      ...plain,
      shift: true,
      selected: ['c'],
      clicked: 'e',
      anchor: 'c'
    })
    const up = selectionAfterClick({ ...plain, shift: true, ...down, clicked: 'a' })

    expect(up).toEqual({ selected: ['a', 'b', 'c'], anchor: 'c' })
  })

  it('adds a range to the selection with Shift and Cmd or Ctrl together', () => {
    const result = selectionAfterClick({
      order,
      shift: true,
      toggle: true,
      selected: ['a', 'd'],
      clicked: 'e',
      anchor: 'd'
    })

    expect(result).toEqual({ selected: ['a', 'd', 'e'], anchor: 'd' })
  })

  it('treats Shift as a plain click when there is no earlier row to reach back to', () => {
    for (const anchor of [null, 'gone']) {
      expect(
        selectionAfterClick({ ...plain, shift: true, selected: [], clicked: 'c', anchor })
      ).toEqual({ selected: ['c'], anchor: 'c' })
    }
  })

  it('reaches back to what was selected on the canvas since the last row click', () => {
    // Row a was clicked, then c was selected on the canvas.
    const result = selectionAfterClick({
      ...plain,
      shift: true,
      selected: ['c'],
      clicked: 'e',
      anchor: 'a'
    })

    expect(result).toEqual({ selected: ['c', 'd', 'e'], anchor: 'c' })
  })

  it('reaches back to a canvas selection when no row was clicked before', () => {
    const result = selectionAfterClick({
      ...plain,
      shift: true,
      selected: ['b'],
      clicked: 'd',
      anchor: null
    })

    expect(result).toEqual({ selected: ['b', 'c', 'd'], anchor: 'b' })
  })

  it('never repeats a row', () => {
    for (const shift of [false, true]) {
      for (const toggle of [false, true]) {
        for (const clicked of order) {
          const { selected } = selectionAfterClick({
            order,
            shift,
            toggle,
            selected: ['b', 'd'],
            clicked,
            anchor: 'd'
          })
          expect(new Set(selected).size).toBe(selected.length)
        }
      }
    }
  })
})
