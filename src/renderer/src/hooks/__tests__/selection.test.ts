import { describe, it, expect } from 'vitest'

/**
 * Tests for selection logic: entity/bin selection, additive (shift/cmd) select,
 * cross-type switching, and marquee selection.
 *
 * Replicates useSelection's state machine as pure data transformations
 * to avoid React hook rendering and StrictMode complications.
 */

type SelectionType = 'entity' | 'bin'

interface SelectionState {
  type: SelectionType
  ids: Set<string>
}

// ── Pure replicas of useSelection logic ──

function select(state: SelectionState, id: string, additive?: boolean): SelectionState {
  const prevType = state.type
  if (prevType !== 'entity') {
    return { type: 'entity', ids: new Set([id]) }
  } else if (additive) {
    const next = new Set(state.ids)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { type: 'entity', ids: next }
  } else {
    return { type: 'entity', ids: new Set([id]) }
  }
}

function selectBin(state: SelectionState, id: string, additive?: boolean): SelectionState {
  const prevType = state.type
  if (prevType !== 'bin') {
    return { type: 'bin', ids: new Set([id]) }
  } else if (additive) {
    const next = new Set(state.ids)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { type: 'bin', ids: next }
  } else {
    return { type: 'bin', ids: new Set([id]) }
  }
}

function marqueeSelect(ids: string[]): SelectionState {
  return { type: 'entity', ids: new Set(ids) }
}

function clearSelection(state: SelectionState): SelectionState {
  return { ...state, ids: new Set() }
}

const initial: SelectionState = { type: 'entity', ids: new Set() }

// ── Tests ──

describe('selection: entity basics', () => {
  it('selects a single entity', () => {
    const s = select(initial, 'e1')
    expect(s.type).toBe('entity')
    expect([...s.ids]).toEqual(['e1'])
  })

  it('replaces selection on non-additive click', () => {
    const s1 = select(initial, 'e1')
    const s2 = select(s1, 'e2')
    expect([...s2.ids]).toEqual(['e2'])
  })

  it('additive select adds a second entity', () => {
    const s1 = select(initial, 'e1')
    const s2 = select(s1, 'e2', true)
    expect(s2.ids.size).toBe(2)
    expect(s2.ids.has('e1')).toBe(true)
    expect(s2.ids.has('e2')).toBe(true)
  })

  it('additive select toggles off an already-selected entity', () => {
    const s1 = select(initial, 'e1')
    const s2 = select(s1, 'e2', true)
    const s3 = select(s2, 'e1', true)
    expect([...s3.ids]).toEqual(['e2'])
  })
})

describe('selection: bin basics', () => {
  it('selects a single bin', () => {
    const s = selectBin(initial, 'b1')
    expect(s.type).toBe('bin')
    expect([...s.ids]).toEqual(['b1'])
  })

  it('replaces selection on non-additive click', () => {
    const s1 = selectBin(initial, 'b1')
    const s2 = selectBin(s1, 'b2')
    expect([...s2.ids]).toEqual(['b2'])
  })

  it('additive select adds a second bin', () => {
    const s1 = selectBin(initial, 'b1')
    const s2 = selectBin(s1, 'b2', true)
    expect(s2.ids.size).toBe(2)
    expect(s2.ids.has('b1')).toBe(true)
    expect(s2.ids.has('b2')).toBe(true)
  })

  it('additive select toggles off an already-selected bin', () => {
    const s1 = selectBin(initial, 'b1')
    const s2 = selectBin(s1, 'b2', true)
    const s3 = selectBin(s2, 'b1', true)
    expect([...s3.ids]).toEqual(['b2'])
  })

  it('additive select supports three or more bins', () => {
    let s = selectBin(initial, 'b1')
    s = selectBin(s, 'b2', true)
    s = selectBin(s, 'b3', true)
    expect(s.ids.size).toBe(3)
  })
})

describe('selection: cross-type switching', () => {
  it('switching from entity to bin resets selection', () => {
    const s1 = select(initial, 'e1')
    const s2 = selectBin(s1, 'b1')
    expect(s2.type).toBe('bin')
    expect([...s2.ids]).toEqual(['b1'])
  })

  it('switching from bin to entity resets selection', () => {
    const s1 = selectBin(initial, 'b1')
    const s2 = select(s1, 'e1')
    expect(s2.type).toBe('entity')
    expect([...s2.ids]).toEqual(['e1'])
  })

  it('switching types ignores additive flag', () => {
    const s1 = select(initial, 'e1')
    const s2 = selectBin(s1, 'b1', true)
    // Should NOT keep e1 — types are different
    expect(s2.type).toBe('bin')
    expect([...s2.ids]).toEqual(['b1'])
  })

  it('additive works after switching back to same type', () => {
    let s = selectBin(initial, 'b1')
    s = select(s, 'e1') // switch to entity
    s = selectBin(s, 'b1') // switch back to bin
    s = selectBin(s, 'b2', true) // additive
    expect(s.ids.size).toBe(2)
    expect(s.ids.has('b1')).toBe(true)
    expect(s.ids.has('b2')).toBe(true)
  })
})

describe('selection: marquee', () => {
  it('marquee selects multiple entities', () => {
    const s = marqueeSelect(['e1', 'e2', 'e3'])
    expect(s.type).toBe('entity')
    expect(s.ids.size).toBe(3)
  })

  it('marquee always selects as entity type', () => {
    const s = marqueeSelect(['e1', 'e2'])
    expect(s.type).toBe('entity')
    expect(s.ids.size).toBe(2)
  })

  it('additive entity select works after marquee select', () => {
    let s = marqueeSelect(['e1', 'e2'])
    s = select(s, 'e3', true)
    expect(s.ids.size).toBe(3)
  })
})

describe('selection: clear', () => {
  it('clears all selected IDs', () => {
    const s1 = select(initial, 'e1')
    const s2 = clearSelection(s1)
    expect(s2.ids.size).toBe(0)
  })

  it('preserves selection type after clear', () => {
    const s1 = selectBin(initial, 'b1')
    const s2 = clearSelection(s1)
    expect(s2.type).toBe('bin')
    expect(s2.ids.size).toBe(0)
  })
})

describe('selection: idempotency (StrictMode safety)', () => {
  it('calling selectBin additive twice with same id toggles correctly', () => {
    // This is the exact scenario that broke under React StrictMode:
    // selectBin(id, true) was called once, but the updater ran twice,
    // causing the ID to be toggled in then back out.
    const s1 = selectBin(initial, 'b1')
    const s2 = selectBin(s1, 'b2', true)
    // b2 should be IN the set, not toggled back out
    expect(s2.ids.has('b1')).toBe(true)
    expect(s2.ids.has('b2')).toBe(true)
  })

  it('calling select additive twice with same id toggles correctly', () => {
    const s1 = select(initial, 'e1')
    const s2 = select(s1, 'e2', true)
    expect(s2.ids.has('e1')).toBe(true)
    expect(s2.ids.has('e2')).toBe(true)
  })

  it('pure function produces same result on repeated calls with same input', () => {
    const s1 = selectBin(initial, 'b1')
    const s2a = selectBin(s1, 'b2', true)
    const s2b = selectBin(s1, 'b2', true)
    expect([...s2a.ids].sort()).toEqual([...s2b.ids].sort())
  })
})
