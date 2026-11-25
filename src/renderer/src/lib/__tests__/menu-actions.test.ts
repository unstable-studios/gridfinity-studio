import { describe, it, expect } from 'vitest'
import { depthChoices, movesIntoBin, movesOutOfBins, sizeSteps } from '../menu-actions'
import type { LayoutGroup } from '@/layout-engine/types'

function bin(id: string, x: number, y: number, width = 84, height = 84): LayoutGroup {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    childIds: [],
    style: { fill: '', stroke: '', strokeWidth: 1 }
  }
}

const box = (id: string, minX: number, minY: number, maxX: number, maxY: number) => ({
  id,
  minX,
  minY,
  maxX,
  maxY
})

describe('sizeSteps', () => {
  const steps = (widthUnits: number, depthUnits: number, heightUnits: number) =>
    sizeSteps({ widthUnits, depthUnits, heightUnits, hasLip: true })

  it('offers one unit more or less each way', () => {
    expect(steps(2, 3, 4).map(({ label, patch }) => [label, patch])).toEqual([
      ['Wider', { widthUnits: 3 }],
      ['Narrower', { widthUnits: 1 }],
      ['Deeper', { depthUnits: 4 }],
      ['Shallower', { depthUnits: 2 }],
      ['Taller', { heightUnits: 5 }],
      ['Shorter', { heightUnits: 3 }]
    ])
    expect(steps(2, 3, 4).every((step) => step.enabled)).toBe(true)
  })

  it('does not offer to go below one unit', () => {
    const disabled = steps(1, 1, 1)
      .filter((step) => !step.enabled)
      .map((step) => step.label)
    expect(disabled).toEqual(['Narrower', 'Shallower', 'Shorter'])
  })
})

describe('depthChoices', () => {
  it('offers the full depth and three shares of it', () => {
    expect(depthChoices(15)).toEqual([
      { label: 'Full depth (15.0 mm)', depth: null },
      { label: 'Three quarters (11.3 mm)', depth: 11.3 },
      { label: 'Half (7.5 mm)', depth: 7.5 },
      { label: 'One quarter (3.8 mm)', depth: 3.8 }
    ])
  })

  it('never offers less than the shallowest pocket there is', () => {
    expect(depthChoices(0.2).map((choice) => choice.depth)).toEqual([null, 0.2, 0.1, 0.1])
  })
})

describe('movesIntoBin', () => {
  it('puts one shape in the middle of the bin', () => {
    // The bin spans x 100..184 and y 16..100, so its middle is (142, 58).
    expect(movesIntoBin([box('s', 0, 0, 10, 20)], bin('b', 100, 100))).toEqual([
      { id: 's', dx: 137, dy: 48 }
    ])
  })

  it('moves several shapes together, keeping how they are arranged', () => {
    const moves = movesIntoBin([box('s', 0, 0, 10, 10), box('t', 30, 0, 40, 10)], bin('b', 0, 84))
    // The pair spans x 0..40, y 0..10: middle (20, 5). The bin's middle is (42, 42).
    expect(moves).toEqual([
      { id: 's', dx: 22, dy: 37 },
      { id: 't', dx: 22, dy: 37 }
    ])
  })

  it('has nothing to move when nothing is given', () => {
    expect(movesIntoBin([], bin('b', 0, 84))).toEqual([])
  })
})

describe('movesOutOfBins', () => {
  it('moves shapes straight right, to just past the last bin', () => {
    const bins = [bin('a', 0, 84), bin('b', 126, 84)]
    // The last bin ends at x 210. The shapes start at x 20, so they move 200.
    expect(movesOutOfBins([box('s', 20, 30, 30, 40), box('t', 50, 30, 60, 40)], bins)).toEqual([
      { id: 's', dx: 200, dy: 0 },
      { id: 't', dx: 200, dy: 0 }
    ])
  })

  it('has nothing to do without bins or without shapes', () => {
    expect(movesOutOfBins([box('s', 0, 0, 1, 1)], [])).toEqual([])
    expect(movesOutOfBins([], [bin('a', 0, 84)])).toEqual([])
  })
})
