import { describe, it, expect } from 'vitest'
import { binsInSelection, exportTitle } from '../export-plan'

const bins = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const shapes = [
  { id: 's1', groupId: 'b' },
  { id: 's2', groupId: null }
]

describe('binsInSelection', () => {
  it('returns selected bins in the order the bins are listed', () => {
    expect(binsInSelection(bins, shapes, ['c', 'a'])).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('counts a bin when one of its shapes is selected', () => {
    expect(binsInSelection(bins, shapes, ['s1'])).toEqual([{ id: 'b' }])
  })

  it('ignores a selected shape that is in no bin', () => {
    expect(binsInSelection(bins, shapes, ['s2'])).toEqual([])
  })

  it('lists a bin once when it and its shape are both selected', () => {
    expect(binsInSelection(bins, shapes, ['b', 's1'])).toEqual([{ id: 'b' }])
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
