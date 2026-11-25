import { describe, it, expect } from 'vitest'
import { describeChange } from '../describe-change'
import type { LayoutGroup, LayoutShape, LayoutSnapshot } from '@/layout-engine/types'

const style = { fill: '', stroke: '', strokeWidth: 1 }

function bin(id: string, patch: Partial<LayoutGroup> = {}, name?: string): LayoutGroup {
  return {
    id,
    x: 0,
    y: 42,
    width: 42,
    height: 42,
    rotation: 0,
    childIds: [],
    style,
    metadata: { widthUnits: 1, depthUnits: 1, heightUnits: 3, hasLip: true, name },
    ...patch
  }
}

function rect(id: string, patch: Record<string, unknown> = {}, name?: string): LayoutShape {
  return {
    id,
    type: 'rect',
    x: 10,
    y: 10,
    rotation: 0,
    fill: '',
    stroke: '',
    strokeWidth: 1,
    groupId: null,
    width: 8,
    height: 6,
    metadata: name ? { name } : undefined,
    ...patch
  } as LayoutShape
}

function layout(groups: LayoutGroup[] = [], shapes: LayoutShape[] = []): LayoutSnapshot {
  return {
    version: '1.0.0',
    groups,
    shapes,
    gridConfig: { size: 42, enabled: true, visible: true }
  }
}

describe('describeChange', () => {
  it('names an added bin or shape', () => {
    expect(describeChange(layout(), layout([bin('a', {}, 'Bin 1')]))).toBe('Add Bin 1')
    expect(describeChange(layout(), layout([], [rect('s')]))).toBe('Add rectangle')
    expect(describeChange(layout(), layout([], [rect('s', {}, 'Slot')]))).toBe('Add Slot')
  })

  it('counts several added at once', () => {
    expect(describeChange(layout(), layout([bin('a'), bin('b')]))).toBe('Add 2 bins')
    expect(describeChange(layout(), layout([], [rect('s'), rect('t')]))).toBe('Add 2 shapes')
    expect(describeChange(layout(), layout([bin('a')], [rect('s'), rect('t')]))).toBe('Add 3 items')
  })

  it('names what was deleted', () => {
    const full = layout([bin('a', {}, 'Bin 1')], [rect('s'), rect('t')])
    expect(describeChange(full, layout([], [rect('s'), rect('t')]))).toBe('Delete Bin 1')
    expect(describeChange(full, layout([bin('a', {}, 'Bin 1')], [rect('s')]))).toBe(
      'Delete rectangle'
    )
    expect(describeChange(full, layout())).toBe('Delete 3 items')
  })

  it('tells a move, a resize and a rename of a bin apart', () => {
    const before = layout([bin('a', {}, 'Bin 1')])
    expect(describeChange(before, layout([bin('a', { x: 42 }, 'Bin 1')]))).toBe('Move Bin 1')
    expect(describeChange(before, layout([bin('a', { width: 84 }, 'Bin 1')]))).toBe('Resize Bin 1')
    expect(describeChange(before, layout([bin('a', {}, 'Tray')]))).toBe('Rename Tray')
  })

  it('calls a change of height or lip a change', () => {
    const before = layout([bin('a', {}, 'Bin 1')])
    const taller = bin('a', {}, 'Bin 1')
    taller.metadata = { ...taller.metadata, heightUnits: 6 }
    expect(describeChange(before, layout([taller]))).toBe('Change Bin 1')
  })

  it('names the bin when its pockets move with it', () => {
    const before = layout([bin('a', {}, 'Bin 1')], [rect('s', { groupId: 'a' })])
    const after = layout([bin('a', { x: 42 }, 'Bin 1')], [rect('s', { groupId: 'a', x: 52 })])
    expect(describeChange(before, after)).toBe('Move Bin 1')
  })

  it('tells a move, a resize, a turn and a rename of a shape apart', () => {
    const before = layout([], [rect('s')])
    expect(describeChange(before, layout([], [rect('s', { x: 20 })]))).toBe('Move rectangle')
    expect(describeChange(before, layout([], [rect('s', { width: 20 })]))).toBe('Resize rectangle')
    expect(describeChange(before, layout([], [rect('s', { rotation: 45 })]))).toBe(
      'Rotate rectangle'
    )
    expect(describeChange(before, layout([], [rect('s', {}, 'Slot')]))).toBe('Rename Slot')
  })

  it('calls a new depth a change', () => {
    const before = layout([], [rect('s')])
    const deeper = rect('s', { metadata: { pocket: { depth: 5 } } })
    expect(describeChange(before, layout([], [deeper]))).toBe('Change rectangle')
  })

  it('counts several shapes changed the same way', () => {
    const before = layout([], [rect('s'), rect('t'), rect('u')])
    const after = layout([], [rect('s', { x: 0 }), rect('t', { x: 0 }), rect('u')])
    expect(describeChange(before, after)).toBe('Move 2 shapes')
  })

  it('says change when shapes changed in different ways', () => {
    const before = layout([], [rect('s'), rect('t')])
    const after = layout([], [rect('s', { x: 0 }), rect('t', { width: 20 })])
    expect(describeChange(before, after)).toBe('Change 2 shapes')
  })

  it('has a name for a step with nothing it can point at', () => {
    expect(describeChange(layout(), layout())).toBe('Change layout')
  })
})
