import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, nameToStore, storedName } from '../item-name'

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

describe('nameToStore with wide characters', () => {
  it('does not cut an emoji in half at the limit', () => {
    const name = nameToStore('a'.repeat(MAX_NAME_LENGTH - 1) + '🔩🔩', 'Bin 1')!

    expect(name.endsWith('🔩')).toBe(true)
    expect(Array.from(name)).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('storedName', () => {
  it('returns a name that is text', () => {
    expect(storedName({ name: 'Screws' })).toBe('Screws')
  })

  it('ignores a missing, empty or non-text name', () => {
    expect(storedName(undefined)).toBeUndefined()
    expect(storedName({})).toBeUndefined()
    expect(storedName({ name: '' })).toBeUndefined()
    expect(storedName({ name: 42 })).toBeUndefined()
    expect(storedName({ name: { first: 'x' } })).toBeUndefined()
  })
})
