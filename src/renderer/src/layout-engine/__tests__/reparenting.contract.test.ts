/**
 * @vitest-environment jsdom
 */
import 'vitest-canvas-mock'

// jsdom doesn't provide ResizeObserver — stub it
globalThis.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { LayoutEngine } from '../interface'
import type { LayoutShape, LayoutGroup } from '../types'
import { createLayoutEngine } from '../create-engine'
// Import adapters to trigger self-registration
import '../fabric-engine'
import '../konva-engine'

/**
 * Reparenting matrix contract tests.
 *
 * Every parent transition × world-position preservation:
 *
 *  - top-level → bin                (addShape(null) + addToGroup)
 *  - bin → top-level                (removeFromGroup)
 *  - bin A → bin B                  (the drag-from-one-bin-to-another path)
 *  - addShape({ groupId }) directly (snapshot-restore semantics)
 *  - addShape(null) + addToGroup    (drawing-tool semantics)
 *  - snapshot restore with grouped shapes
 *  - undo/redo across reparent (simulated via snapshot push/pop)
 *
 * The single invariant under test for each path: the shape's world-space
 * centroid must be preserved (within a small ε for floating-point).
 */

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(div, 'clientHeight', { value: 600, configurable: true })
  document.body.appendChild(div)
  return div
}

function makeRect(overrides: Partial<LayoutShape> = {}): LayoutShape {
  return {
    id: 'rect-1',
    type: 'rect' as const,
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    rotation: 0,
    fill: '#cccccc',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null,
    ...overrides
  } as LayoutShape
}

function makeGroup(overrides: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id: 'g-1',
    x: 0,
    y: 100,
    width: 100,
    height: 100,
    rotation: 0,
    childIds: [],
    style: { fill: 'transparent', stroke: '#666', strokeWidth: 1 },
    ...overrides
  }
}

/**
 * World position of a shape: top-level shapes use their own x/y; grouped
 * shapes are stored relative to the parent's centroid.
 */
function shapeWorld(shape: LayoutShape, group: LayoutGroup | undefined): { x: number; y: number } {
  if (!group) return { x: shape.x, y: shape.y }
  return {
    x: group.x + group.width / 2 + shape.x,
    y: group.y - group.height / 2 + shape.y
  }
}

function readWorld(engine: LayoutEngine, shapeId: string): { x: number; y: number } {
  const s = engine.getShape(shapeId)!
  const g = s.groupId ? engine.getGroup(s.groupId) : undefined
  return shapeWorld(s, g)
}

// ─── Per-engine matrix ─────────────────────────────────────────────────────

const engineTypes = ['fabric', 'konva'] as const

describe.each(engineTypes)('Reparenting matrix (%s)', (engineType) => {
  let engine: LayoutEngine
  let container: HTMLDivElement

  beforeEach(() => {
    container = makeContainer()
    engine = createLayoutEngine(engineType)
    engine.mount(container)
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  // ─── top-level → bin (drawing-tool path) ─────────────────────────────────

  it('top-level shape → bin via addToGroup preserves world position', () => {
    // Bin spans world x ∈ [0,100], y ∈ [0,100]; centroid (50, 50).
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    // Top-level shape at world (40, 60).
    engine.addShape(makeRect({ id: 'r', x: 40, y: 60 }))
    expect(readWorld(engine, 'r')).toEqual({ x: 40, y: 60 })

    engine.addToGroup('r', 'bin')

    const after = readWorld(engine, 'r')
    expect(after.x).toBeCloseTo(40, 0)
    expect(after.y).toBeCloseTo(60, 0)
    // groupId now references the bin
    expect(engine.getShape('r')!.groupId).toBe('bin')
    // Bin's childIds was updated
    expect(engine.getGroup('bin')!.childIds).toContain('r')
  })

  // ─── bin → top-level ─────────────────────────────────────────────────────

  it('bin shape → top-level via removeFromGroup preserves world position', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    // Child stored locally — centroid (50, 50). Local (-10, 10) = world (40, 60).
    engine.addShape(makeRect({ id: 'r', x: -10, y: 10, groupId: 'bin' }))
    expect(readWorld(engine, 'r')).toEqual(expect.objectContaining({ x: 40, y: 60 }))

    engine.removeFromGroup('r')

    const after = readWorld(engine, 'r')
    expect(after.x).toBeCloseTo(40, 0)
    expect(after.y).toBeCloseTo(60, 0)
    // groupId is now null
    expect(engine.getShape('r')!.groupId).toBeNull()
    // Bin's childIds was cleaned
    expect(engine.getGroup('bin')!.childIds).not.toContain('r')
  })

  // ─── bin A → bin B (the drag-between-bins path) ──────────────────────────

  it('bin A → bin B via addToGroup preserves world position', () => {
    engine.createGroup(makeGroup({ id: 'a', x: 0, y: 100, width: 100, height: 100 }))
    engine.createGroup(makeGroup({ id: 'b', x: 200, y: 100, width: 100, height: 100 }))
    // Place shape inside bin A at world (40, 60). Local (-10, 10) since A's
    // centroid is (50, 50).
    engine.addShape(makeRect({ id: 'r', x: -10, y: 10, groupId: 'a' }))

    // The shape needs to first be visually moved into bin B's world span.
    // We simulate this by moving the shape via updateShape to a world position
    // that lies inside bin B. Bin B's centroid is (250, 50). The shape's
    // local-to-A coords need to map to a world inside B. Simulating drag-to-B
    // accurately would mean the engine handles the world↔local conversion
    // during reparent — that's exactly the contract we're testing.
    //
    // Pre-move the shape to be at world (240, 60) inside A's local frame:
    //   local = world - centroid = (240, 60) - (50, 50) = (190, 10)
    engine.updateShape('r', { x: 190, y: 10 })
    expect(readWorld(engine, 'r')).toEqual(expect.objectContaining({ x: 240, y: 60 }))

    // Now reparent A → B. World position must be preserved.
    engine.addToGroup('r', 'b')

    const after = readWorld(engine, 'r')
    expect(after.x).toBeCloseTo(240, 0)
    expect(after.y).toBeCloseTo(60, 0)
    expect(engine.getShape('r')!.groupId).toBe('b')
    expect(engine.getGroup('a')!.childIds).not.toContain('r')
    expect(engine.getGroup('b')!.childIds).toContain('r')
  })

  // ─── addShape with groupId set (snapshot-restore semantics) ──────────────

  it('addShape({ groupId }) treats x/y as already group-local', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    // Centroid is (50, 50). Local (-10, 10) → world (40, 60).
    engine.addShape(makeRect({ id: 'r', x: -10, y: 10, groupId: 'bin' }))

    const w = readWorld(engine, 'r')
    expect(w.x).toBeCloseTo(40, 0)
    expect(w.y).toBeCloseTo(60, 0)
  })

  // ─── addShape(null) + addToGroup (drawing-tool path) ─────────────────────

  it('addShape(null) + addToGroup treats x/y as world-space then converts', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    // Add as top-level at world (40, 60), then attach to the bin.
    engine.addShape(makeRect({ id: 'r', x: 40, y: 60, groupId: null }))
    engine.addToGroup('r', 'bin')

    const w = readWorld(engine, 'r')
    expect(w.x).toBeCloseTo(40, 0)
    expect(w.y).toBeCloseTo(60, 0)
  })

  // ─── snapshot restore with grouped shapes ────────────────────────────────

  it('snapshot restore preserves world position for grouped shapes', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 50, y: 200, width: 100, height: 100 }))
    engine.addShape(makeRect({ id: 'r', x: -10, y: 10, groupId: 'bin' }))
    const beforeWorld = readWorld(engine, 'r')

    const snap = engine.toSnapshot()
    engine.loadSnapshot(snap)

    const afterWorld = readWorld(engine, 'r')
    expect(afterWorld.x).toBeCloseTo(beforeWorld.x, 0)
    expect(afterWorld.y).toBeCloseTo(beforeWorld.y, 0)
  })

  // ─── undo/redo across reparent (simulated via snapshots) ────────────────

  it('undo across top-level → bin restores top-level state', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    engine.addShape(makeRect({ id: 'r', x: 40, y: 60 }))
    const before = engine.toSnapshot()

    engine.addToGroup('r', 'bin')
    expect(engine.getShape('r')!.groupId).toBe('bin')

    // Undo via snapshot replay
    engine.loadSnapshot(before)
    expect(engine.getShape('r')!.groupId).toBeNull()
    const w = readWorld(engine, 'r')
    expect(w.x).toBeCloseTo(40, 0)
    expect(w.y).toBeCloseTo(60, 0)
  })

  it('redo after undo of reparent restores the grouped state', () => {
    engine.createGroup(makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 }))
    engine.addShape(makeRect({ id: 'r', x: 40, y: 60 }))
    const before = engine.toSnapshot()

    engine.addToGroup('r', 'bin')
    const after = engine.toSnapshot()

    // Undo
    engine.loadSnapshot(before)
    expect(engine.getShape('r')!.groupId).toBeNull()
    // Redo
    engine.loadSnapshot(after)
    expect(engine.getShape('r')!.groupId).toBe('bin')
    const w = readWorld(engine, 'r')
    expect(w.x).toBeCloseTo(40, 0)
    expect(w.y).toBeCloseTo(60, 0)
  })

  // ─── Three-way A → B → top-level → A loop ───────────────────────────────

  it('A → B → top-level → A loop preserves world position throughout', () => {
    engine.createGroup(makeGroup({ id: 'a', x: 0, y: 100, width: 100, height: 100 }))
    engine.createGroup(makeGroup({ id: 'b', x: 200, y: 100, width: 100, height: 100 }))
    // World (40, 60), local-to-A (-10, 10).
    engine.addShape(makeRect({ id: 'r', x: -10, y: 10, groupId: 'a' }))

    // Move so it sits "inside" bin B's world span at (240, 60); local-to-A (190, 10).
    engine.updateShape('r', { x: 190, y: 10 })
    expect(readWorld(engine, 'r')).toEqual(expect.objectContaining({ x: 240, y: 60 }))

    // A → B
    engine.addToGroup('r', 'b')
    expect(readWorld(engine, 'r').x).toBeCloseTo(240, 0)
    expect(readWorld(engine, 'r').y).toBeCloseTo(60, 0)
    expect(engine.getShape('r')!.groupId).toBe('b')

    // B → top-level
    engine.removeFromGroup('r')
    expect(readWorld(engine, 'r').x).toBeCloseTo(240, 0)
    expect(readWorld(engine, 'r').y).toBeCloseTo(60, 0)
    expect(engine.getShape('r')!.groupId).toBeNull()

    // Move back into A's span at world (40, 60)
    engine.updateShape('r', { x: 40, y: 60 })
    // top-level → A
    engine.addToGroup('r', 'a')
    expect(readWorld(engine, 'r').x).toBeCloseTo(40, 0)
    expect(readWorld(engine, 'r').y).toBeCloseTo(60, 0)
    expect(engine.getShape('r')!.groupId).toBe('a')
  })

  // ─── childIds invariant under all transitions ────────────────────────────

  it("groups' childIds list stays consistent through repeated reparents", () => {
    engine.createGroup(makeGroup({ id: 'a', x: 0, y: 100, width: 100, height: 100 }))
    engine.createGroup(makeGroup({ id: 'b', x: 200, y: 100, width: 100, height: 100 }))
    engine.addShape(makeRect({ id: 'r', x: 40, y: 60 }))

    // Initially in neither bin
    expect(engine.getGroup('a')!.childIds).not.toContain('r')
    expect(engine.getGroup('b')!.childIds).not.toContain('r')

    engine.addToGroup('r', 'a')
    expect(engine.getGroup('a')!.childIds).toContain('r')
    expect(engine.getGroup('b')!.childIds).not.toContain('r')

    engine.addToGroup('r', 'b')
    expect(engine.getGroup('a')!.childIds).not.toContain('r')
    expect(engine.getGroup('b')!.childIds).toContain('r')

    engine.removeFromGroup('r')
    expect(engine.getGroup('a')!.childIds).not.toContain('r')
    expect(engine.getGroup('b')!.childIds).not.toContain('r')
  })
})
