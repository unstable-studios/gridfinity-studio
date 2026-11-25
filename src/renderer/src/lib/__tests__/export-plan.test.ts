import { describe, it, expect } from 'vitest'
import { allCheckedState, checkedBins, exportTitle } from '../export-plan'

const bins = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('checkedBins', () => {
  it('takes every bin when none is unchecked', () => {
    expect(checkedBins(bins, [])).toEqual(bins)
  })

  it('leaves out unchecked bins and keeps the order', () => {
    expect(checkedBins(bins, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('ignores an unchecked bin that no longer exists', () => {
    expect(checkedBins(bins, ['gone'])).toEqual(bins)
  })

  it('takes nothing when every bin is unchecked', () => {
    expect(checkedBins(bins, ['c', 'a', 'b'])).toEqual([])
  })
})

describe('allCheckedState', () => {
  it('is checked when every bin is', () => {
    expect(allCheckedState(3, 3)).toBe(true)
  })

  it('is unchecked when no bin is', () => {
    expect(allCheckedState(0, 3)).toBe(false)
  })

  it('is in between when some are', () => {
    expect(allCheckedState(1, 3)).toBe('indeterminate')
  })
})

describe('exportTitle', () => {
  it('uses the project name when every bin is exported', () => {
    expect(exportTitle('Workshop', bins, bins)).toBe('Workshop')
  })

  it('uses the project name when the only bin is exported', () => {
    expect(exportTitle('Workshop', [{ id: 'a' }], [{ id: 'a', name: 'Pliers' }])).toBe('Workshop')
  })

  it('uses the bin name when one of several bins is exported', () => {
    expect(exportTitle('Workshop', bins, [{ id: 'b', name: 'Pliers' }])).toBe('Pliers')
  })

  it('falls back to "Bin" for a bin with no name', () => {
    expect(exportTitle('Workshop', bins, [{ id: 'b' }])).toBe('Bin')
  })

  it('says how many bins when some of them are exported', () => {
    expect(exportTitle('Workshop', bins, [{ id: 'a' }, { id: 'c' }])).toBe('Workshop - 2 bins')
  })
})
