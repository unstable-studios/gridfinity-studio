import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, nameToStore } from '../item-name'

describe('nameToStore', () => {
  it('returns the typed name', () => {
    expect(nameToStore('Screws', 'Bin 1')).toBe('Screws')
  })

  it('tidies spaces', () => {
    expect(nameToStore('  M3   screws ', 'Bin 1')).toBe('M3 screws')
  })

  it('keeps the old name when nothing was typed', () => {
    expect(nameToStore('', 'Bin 1')).toBeNull()
    expect(nameToStore('   ', 'Bin 1')).toBeNull()
  })

  it('keeps the old name when it did not change', () => {
    expect(nameToStore('Bin 1', 'Bin 1')).toBeNull()
    expect(nameToStore(' Bin 1 ', 'Bin 1')).toBeNull()
  })

  it('names something that had no name', () => {
    expect(nameToStore('Screws', undefined)).toBe('Screws')
  })

  it('cuts a very long name', () => {
    expect(nameToStore('a'.repeat(200), 'Bin 1')).toHaveLength(MAX_NAME_LENGTH)
  })
})
