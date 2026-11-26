import { describe, expect, it } from 'vitest'
import { copySelection, PASTE_OFFSET, planPaste, planPasteAt } from '../clipboard'
import type { LayoutGroup, LayoutShape } from '@/layout-engine/types'

function bin(id: string, x: number, overrides: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id,
    x,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { fill: 'transparent', stroke: '#666666', strokeWidth: 1 },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: `Bin ${id}` },
    ...overrides
  }
}

function rect(id: string, x: number, y: number, groupId: string | null = null): LayoutShape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 10,
    height: 10,
    rotation: 0,
    fill: '#bbbbbb',
    stroke: '#000000',
    strokeWidth: 1,
    groupId,
    metadata: { name: `Rectangle ${id}`, pocket: { clearance: 0.25 } }
  }
}

/** Ids n1, n2, ... in the order they are asked for. */
function counter(): () => string {
  let n = 0
  return () => `n${++n}`
}

describe('copySelection', () => {
  // Bin a is centered on (42, 42). Shape s1 is 5 mm right of that center.
  const groups = [bin('a', 0, { childIds: ['s1'] }), bin('b', 126)]
  const shapes = [rect('s1', 5, -3, 'a'), rect('s2', 300, 300)]

  it('copies nothing when nothing is selected', () => {
    expect(copySelection(groups, shapes, [])).toBeNull()
    expect(copySelection(groups, shapes, ['gone'])).toBeNull()
  })

  it('copies a bin with what is in it, at canvas positions', () => {
    const content = copySelection(groups, shapes, ['a'])!

    expect(content.groups.map((g) => g.id)).toEqual(['a'])
    expect(content.shapes).toHaveLength(1)
    expect(content.shapes[0]).toMatchObject({ id: 's1', x: 47, y: 39, groupId: 'a' })
  })

  it('copies a shape on its own without its bin', () => {
    const content = copySelection(groups, shapes, ['s1'])!

    expect(content.groups).toEqual([])
    expect(content.shapes[0]).toMatchObject({ id: 's1', x: 47, y: 39, groupId: null })
  })

  it('does not copy a shape twice when it and its bin are both selected', () => {
    const content = copySelection(groups, shapes, ['a', 's1', 's2'])!

    expect(content.shapes.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(content.shapes[0].groupId).toBe('a')
  })

  it('does not share data with the originals', () => {
    const content = copySelection(groups, shapes, ['a'])!
    ;(content.shapes[0].metadata!.pocket as { clearance: number }).clearance = 9

    expect((shapes[0].metadata!.pocket as { clearance: number }).clearance).toBe(0.25)
  })
})

describe('planPaste', () => {
  const groups = [bin('a', 0, { childIds: ['s1'] }), bin('b', 126)]
  const shapes = [rect('s1', 5, -3, 'a'), rect('s2', 300, 300)]

  it('puts a pasted bin one unit to the right of every bin, with its shapes', () => {
    const content = copySelection(groups, shapes, ['a'])!
    const plan = planPaste(content, groups, 42, 1, counter())

    // Bins end at x = 210, so the copy starts at 252: moved by 252.
    expect(plan.groups[0]).toMatchObject({ id: 'n1', x: 252, y: 84, childIds: [] })
    expect(plan.shapes[0]).toMatchObject({ id: 'n2', x: 47 + 252, y: 39, groupId: null })
    expect(plan.shapeGroup.get('n2')).toBe('n1')
  })

  it('keeps the arrangement of several pasted bins', () => {
    const content = copySelection(groups, shapes, ['a', 'b'])!
    const plan = planPaste(content, groups, 42, 1, counter())

    expect(plan.groups.map((g) => g.x)).toEqual([252, 378])
  })

  it('pastes a bin where it was when no bin is left on the canvas', () => {
    const content = copySelection(groups, shapes, ['a'])!
    const plan = planPaste(content, [], 42, 0, counter())

    expect(plan.groups[0].x).toBe(0)
    expect(plan.shapes[0]).toMatchObject({ x: 47, y: 39 })
  })

  it('pastes a cut bin back where it was when that space is still free', () => {
    const content = copySelection(groups, shapes, ['a'])!
    // Bin a was cut. Bin b is still there, and not in the way.
    const plan = planPaste(content, [groups[1]], 42, 0, counter())

    expect(plan.groups[0].x).toBe(0)
    expect(plan.shapes[0]).toMatchObject({ x: 47, y: 39 })
  })

  it('moves a pasted bin clear when another bin has taken its place', () => {
    const content = copySelection(groups, shapes, ['a'])!
    const squatter = bin('c', 42)
    const plan = planPaste(content, [groups[1], squatter], 42, 0, counter())

    // Bins end at x = 210, so the paste starts at 252.
    expect(plan.groups[0].x).toBe(252)
  })

  it('lets a pasted bin touch another without moving it', () => {
    const content = copySelection(groups, shapes, ['a'])!
    const neighbor = bin('c', 84)

    expect(planPaste(content, [neighbor], 42, 0, counter()).groups[0].x).toBe(0)
  })

  it('does not invent a name for something that had none', () => {
    const unnamed = [bin('a', 0, { metadata: { widthUnits: 2 } })]
    const loose = [{ ...rect('s9', 300, 300), metadata: { pocket: { clearance: 0.25 } } }]
    const plan = planPaste(copySelection(unnamed, loose, ['a', 's9'])!, unnamed, 42, 1, counter())

    expect(plan.groups[0].metadata).toEqual({ widthUnits: 2 })
    expect(plan.shapes[0].metadata).toEqual({ pocket: { clearance: 0.25 } })
  })

  it('moves a shape copied on its own a step further with each paste', () => {
    const content = copySelection(groups, shapes, ['s2'])!

    expect(planPaste(content, groups, 42, 0, counter()).shapes[0]).toMatchObject({ x: 300, y: 300 })
    expect(planPaste(content, groups, 42, 2, counter()).shapes[0]).toMatchObject({
      x: 300 + 2 * PASTE_OFFSET,
      y: 300 + 2 * PASTE_OFFSET
    })
    expect(planPaste(content, groups, 42, 1, counter()).shapeGroup.size).toBe(0)
  })

  it('names copies so they can be told from the originals', () => {
    const content = copySelection(groups, shapes, ['a', 's2'])!
    const plan = planPaste(content, groups, 42, 1, counter())

    expect(plan.groups[0].metadata!.name).toBe('Bin a copy')
    // In a copied bin the shape keeps its name. Beside its original it does not.
    expect(plan.shapes.map((s) => s.metadata!.name)).toEqual(['Rectangle s1', 'Rectangle s2 copy'])
    expect(
      planPaste(copySelection(plan.groups, [], ['n1'])!, [], 42, 1, counter()).groups[0].metadata!
        .name
    ).toBe('Bin a copy')
  })

  it('keeps names on the first paste after a cut', () => {
    const content = copySelection(groups, shapes, ['a', 's2'])!
    const plan = planPaste(content, [groups[1]], 42, 0, counter())

    expect(plan.groups[0].metadata!.name).toBe('Bin a')
    expect(plan.shapes.map((s) => s.metadata!.name)).toEqual(['Rectangle s1', 'Rectangle s2'])
  })

  it('gives everything a new id', () => {
    const content = copySelection(groups, shapes, ['a', 'b', 's2'])!
    const plan = planPaste(content, groups, 42, 1, counter())
    const ids = [...plan.groups, ...plan.shapes].map((item) => item.id)

    expect(new Set(ids).size).toBe(4)
    expect(ids.some((id) => ['a', 'b', 's1', 's2'].includes(id))).toBe(false)
  })
})

describe('planPasteAt', () => {
  it('puts the middle of a copied shape at the point', () => {
    const content = copySelection([], [rect('s', 10, 20)], ['s'])!
    const plan = planPasteAt(content, [], 42, { x: 100, y: 50 }, true, counter())!
    expect(plan.shapes[0]).toMatchObject({ x: 100, y: 50, groupId: null })
  })

  it('keeps several shapes arranged as they were, around the point', () => {
    const content = copySelection([], [rect('s', 0, 0), rect('t', 20, 10)], ['s', 't'])!
    const plan = planPasteAt(content, [], 42, { x: 100, y: 100 }, true, counter())!
    expect(plan.shapes.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 90, y: 95 },
      { x: 110, y: 105 }
    ])
  })

  it('moves a bin by whole grid squares, with its pockets', () => {
    const groups = [bin('a', 0)]
    const content = copySelection(groups, [rect('s', 5, -5, 'a')], ['a'])!
    // The bin's middle is at (42, 42). The point is 110 right and 95 down of it.
    const plan = planPasteAt(content, groups, 42, { x: 152, y: 137 }, true, counter())!
    expect(plan.groups[0]).toMatchObject({ x: 126, y: 168, width: 84, height: 84 })
    // The pocket was at (47, 37) on the canvas and moved the same 126 and 84.
    expect(plan.shapes[0]).toMatchObject({ x: 173, y: 121 })
    expect(plan.shapeGroup.get(plan.shapes[0].id)).toBe(plan.groups[0].id)
  })

  it('refuses when a pasted bin would land on another', () => {
    const groups = [bin('a', 0)]
    const content = copySelection(groups, [], ['a'])!
    expect(planPasteAt(content, groups, 42, { x: 60, y: 42 }, true, counter())).toBeNull()
  })

  it('lets a pasted bin touch another', () => {
    const groups = [bin('a', 0)]
    const content = copySelection(groups, [], ['a'])!
    const plan = planPasteAt(content, groups, 42, { x: 126, y: 42 }, true, counter())!
    expect(plan.groups[0].x).toBe(84)
  })

  it('names copies, and keeps names after a cut', () => {
    const content = copySelection([], [rect('s', 0, 0)], ['s'])!
    const copy = planPasteAt(content, [], 42, { x: 5, y: 5 }, true, counter())!
    const cut = planPasteAt(content, [], 42, { x: 5, y: 5 }, false, counter())!
    expect(copy.shapes[0].metadata?.name).toBe('Rectangle s copy')
    expect(cut.shapes[0].metadata?.name).toBe('Rectangle s')
  })
})
