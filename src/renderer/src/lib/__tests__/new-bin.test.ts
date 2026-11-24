import { describe, it, expect } from 'vitest'
import { nextBinName } from '../new-bin'

describe('nextBinName', () => {
  it('starts at Bin 1', () => {
    expect(nextBinName([])).toBe('Bin 1')
  })

  it('goes one past the highest number, not the count', () => {
    expect(nextBinName(['Bin 2', 'Bin 3'])).toBe('Bin 4')
  })

  it('ignores names that are not "Bin" and a number', () => {
    expect(nextBinName(['Pliers', 'Bin 1 copy', undefined, 'Bin x'])).toBe('Bin 1')
  })
})
