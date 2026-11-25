import { describe, it, expect } from 'vitest'
import { largestFirst } from '../stacking'

describe('largestFirst', () => {
  it('puts a small shape above the large one it was drawn before', () => {
    expect(
      largestFirst([
        { id: 'small', area: 100 },
        { id: 'large', area: 900 }
      ])
    ).toEqual(['large', 'small'])
  })

  it('leaves shapes that are already largest first alone', () => {
    const shapes = [
      { id: 'a', area: 900 },
      { id: 'b', area: 400 },
      { id: 'c', area: 100 }
    ]
    expect(largestFirst(shapes)).toEqual(['a', 'b', 'c'])
  })

  it('keeps shapes of one size in the order they were in', () => {
    expect(
      largestFirst([
        { id: 'first', area: 100 },
        { id: 'big', area: 500 },
        { id: 'second', area: 100 },
        { id: 'third', area: 100 }
      ])
    ).toEqual(['big', 'first', 'second', 'third'])
  })

  it('treats sizes a rounding error apart as the same', () => {
    expect(
      largestFirst([
        { id: 'first', area: 1600 },
        { id: 'second', area: 1600.0000001 }
      ])
    ).toEqual(['first', 'second'])
  })

  it('copes with none or one', () => {
    expect(largestFirst([])).toEqual([])
    expect(largestFirst([{ id: 'only', area: 1 }])).toEqual(['only'])
  })
})
