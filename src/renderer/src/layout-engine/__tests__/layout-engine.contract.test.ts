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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { LayoutEngine } from '../interface'
import type { LayoutShape, LayoutGroup } from '../types'
import { createLayoutEngine } from '../create-engine'
import { checkGroupCollision } from '../collision'
// Import adapters to trigger self-registration
import '../fabric-engine'
import '../konva-engine'

// ─── Helpers ────────────────────────────────────────────────────────────────────

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
    x: 42,
    y: 42,
    width: 168,
    height: 168,
    rotation: 0,
    fill: '#cccccc',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null,
    ...overrides
  } as LayoutShape
}

function makeCircle(overrides: Partial<LayoutShape> = {}): LayoutShape {
  return {
    id: 'circle-1',
    type: 'circle' as const,
    x: 210,
    y: 210,
    radiusX: 42,
    radiusY: 42,
    rotation: 0,
    fill: '#aaaaaa',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null,
    ...overrides
  } as LayoutShape
}

function makePolygon(overrides: Partial<LayoutShape> = {}): LayoutShape {
  return {
    id: 'polygon-1',
    type: 'polygon' as const,
    x: 0,
    y: 0,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 80 }
    ],
    rotation: 0,
    fill: '#bbbbbb',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null,
    ...overrides
  } as LayoutShape
}

function makeGroup(overrides: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id: 'group-1',
    x: 84,
    y: 84,
    width: 168,
    height: 168,
    rotation: 0,
    childIds: [],
    style: {
      fill: 'transparent',
      stroke: '#666666',
      strokeWidth: 1
    },
    ...overrides
  }
}

// ─── Parameterized Contract Tests ───────────────────────────────────────────────

const engineTypes = ['fabric', 'konva'] as const

describe.each(engineTypes)('LayoutEngine contract (%s)', (engineType) => {
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

  // ─── C1-C4: Shape CRUD ──────────────────────────────────────────────────────

  describe('Shape CRUD', () => {
    it('C1: addShape(rect) → getShape returns shape with correct properties', () => {
      const rect = makeRect()
      engine.addShape(rect)
      const retrieved = engine.getShape('rect-1')
      expect(retrieved).toBeDefined()
      expect(retrieved!.type).toBe('rect')
      expect(retrieved!.x).toBe(42)
      expect(retrieved!.y).toBe(42)
      if (retrieved!.type === 'rect') {
        expect(retrieved!.width).toBe(168)
        expect(retrieved!.height).toBe(168)
      }
    })

    it('C2: addShape(circle) + addShape(polygon) → getAllShapes returns both', () => {
      engine.addShape(makeCircle())
      engine.addShape(makePolygon())
      const all = engine.getAllShapes()
      expect(all).toHaveLength(2)
      const types = all.map((s) => s.type).sort()
      expect(types).toEqual(['circle', 'polygon'])
    })

    it('C3: updateShape(id, { x: 100 }) → getShape(id).x === 100', () => {
      engine.addShape(makeRect())
      engine.updateShape('rect-1', { x: 100 })
      const shape = engine.getShape('rect-1')
      expect(shape!.x).toBe(100)
    })

    it('C4: removeShape(id) → getShape(id) returns undefined', () => {
      engine.addShape(makeRect())
      engine.removeShape('rect-1')
      expect(engine.getShape('rect-1')).toBeUndefined()
    })
  })

  // ─── C5-C8: Group Operations ────────────────────────────────────────────────

  describe('Group Operations', () => {
    it('C5: createGroup with childIds → children groupId is set', () => {
      const rect = makeRect({ id: 'pocket-1' })
      const circle = makeCircle({ id: 'pocket-2' })
      engine.addShape(rect)
      engine.addShape(circle)
      engine.createGroup(makeGroup({ childIds: ['pocket-1', 'pocket-2'] }))

      const s1 = engine.getShape('pocket-1')
      const s2 = engine.getShape('pocket-2')
      expect(s1!.groupId).toBe('group-1')
      expect(s2!.groupId).toBe('group-1')
    })

    it('C6: removeGroup → children become top-level with correct positions', () => {
      const rect = makeRect({ id: 'pocket-1' })
      const circle = makeCircle({ id: 'pocket-2' })
      engine.addShape(rect)
      engine.addShape(circle)
      engine.createGroup(makeGroup({ childIds: ['pocket-1', 'pocket-2'] }))
      engine.removeGroup('group-1')

      const s1 = engine.getShape('pocket-1')
      const s2 = engine.getShape('pocket-2')
      expect(s1!.groupId).toBeNull()
      expect(s2!.groupId).toBeNull()
      expect(engine.getGroup('group-1')).toBeUndefined()
    })

    it('C7: addToGroup → shape appears in group children', () => {
      engine.addShape(makeRect({ id: 'pocket-1' }))
      engine.createGroup(makeGroup({ childIds: [] }))
      engine.addToGroup('pocket-1', 'group-1')

      const group = engine.getGroup('group-1')
      expect(group!.childIds).toContain('pocket-1')
      const shape = engine.getShape('pocket-1')
      expect(shape!.groupId).toBe('group-1')
    })

    it('C8: removeFromGroup → shape becomes top-level', () => {
      engine.addShape(makeRect({ id: 'pocket-1' }))
      engine.createGroup(makeGroup({ childIds: ['pocket-1'] }))
      engine.removeFromGroup('pocket-1')

      const shape = engine.getShape('pocket-1')
      expect(shape!.groupId).toBeNull()
      const group = engine.getGroup('group-1')
      expect(group!.childIds).not.toContain('pocket-1')
    })
  })

  // ─── C22: Group positions stable under multi-select ────────────────────────

  describe('Group position stability', () => {
    it('C22: getAllGroups returns correct positions when multiple groups are selected', () => {
      // When multiple groups are selected in Fabric, an ActiveSelection wraps
      // them and changes their left/top to selection-relative coords. The engine
      // must still return world-space positions from getGroup/getAllGroups.
      const g1 = makeGroup({ id: 'g1', x: 0, y: 84, width: 84, height: 84 })
      const g2 = makeGroup({ id: 'g2', x: 126, y: 84, width: 84, height: 84 })
      engine.createGroup(g1)
      engine.createGroup(g2)

      // Select both — in Fabric this creates an ActiveSelection
      engine.select(['g1', 'g2'])

      const groups = engine.getAllGroups()
      const got1 = groups.find((g) => g.id === 'g1')!
      const got2 = groups.find((g) => g.id === 'g2')!

      expect(got1.x).toBeCloseTo(0, 0)
      expect(got1.y).toBeCloseTo(84, 0)
      expect(got2.x).toBeCloseTo(126, 0)
      expect(got2.y).toBeCloseTo(84, 0)
    })

    it('C23: toSnapshot preserves group positions when groups are selected', () => {
      const g1 = makeGroup({ id: 'g1', x: 0, y: 84, width: 84, height: 84 })
      const g2 = makeGroup({ id: 'g2', x: 126, y: 84, width: 84, height: 84 })
      engine.createGroup(g1)
      engine.createGroup(g2)

      engine.select(['g1', 'g2'])
      const snapshot = engine.toSnapshot()

      const snap1 = snapshot.groups.find((g) => g.id === 'g1')!
      const snap2 = snapshot.groups.find((g) => g.id === 'g2')!

      expect(snap1.x).toBeCloseTo(0, 0)
      expect(snap1.y).toBeCloseTo(84, 0)
      expect(snap2.x).toBeCloseTo(126, 0)
      expect(snap2.y).toBeCloseTo(84, 0)
    })

    // Helper for issue #279 / #281 / #285: compute a child shape's world
    // position from its (parent-relative) stored coords.
    const childWorld = (shape: LayoutShape, group: LayoutGroup): { x: number; y: number } => ({
      x: group.x + group.width / 2 + shape.x,
      y: group.y - group.height / 2 + shape.y
    })

    it('C26 (#279): createGroup with already-existing children preserves their world position', () => {
      // Bin spans world (84..168, -84..84) → centroid (126, 0).
      const bin = makeGroup({
        id: 'bin',
        x: 84,
        y: 84,
        width: 84,
        height: 84,
        childIds: []
      })
      // Place the rect at world (110, -10) — clearly inside the bin.
      const rect = makeRect({ id: 'r1', x: 110, y: -10, width: 30, height: 30 })

      engine.addShape(rect)
      engine.createGroup({ ...bin, childIds: ['r1'] })

      const stored = engine.getShape('r1')!
      const updatedBin = engine.getGroup('bin')!
      const world = childWorld(stored, updatedBin)
      expect(world.x).toBeCloseTo(110, 0)
      expect(world.y).toBeCloseTo(-10, 0)
      expect(stored.groupId).toBe('bin')
    })

    it('C27 (#281): updateGroup({ width, height }) preserves child world position', () => {
      const bin = makeGroup({ id: 'bin', x: 0, y: 84, width: 84, height: 84 })
      // Shape at world (40, 40) inside the bin — local (-2, -2) since centroid is (42, 42).
      const rect = makeRect({ id: 'r1', x: -2, y: -2, width: 20, height: 20, groupId: 'bin' })

      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(rect)

      const before = engine.getShape('r1')!
      const beforeBin = engine.getGroup('bin')!
      const beforeWorld = childWorld(before, beforeBin)

      // Grow the bin from 84×84 to 168×168 (lower-left anchored)
      engine.updateGroup('bin', { width: 168, height: 168 })

      const after = engine.getShape('r1')!
      const afterBin = engine.getGroup('bin')!
      const afterWorld = childWorld(after, afterBin)
      expect(afterWorld.x).toBeCloseTo(beforeWorld.x, 0)
      expect(afterWorld.y).toBeCloseTo(beforeWorld.y, 0)
      // Bin's lower-left didn't move; only width/height grew.
      expect(afterBin.x).toBe(0)
      expect(afterBin.y).toBe(84)
      expect(afterBin.width).toBe(168)
      expect(afterBin.height).toBe(168)
    })

    it('C28 (#285): toSnapshot → loadSnapshot round-trip preserves grouped shape coords', () => {
      const bin = makeGroup({ id: 'bin', x: 0, y: 84, width: 84, height: 84 })
      const rect = makeRect({ id: 'r1', x: -2, y: -2, width: 20, height: 20, groupId: 'bin' })

      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(rect)

      const initial = engine.toSnapshot()

      // Three round-trips — pre-fix this would drift by the bin's centroid
      // magnitude on each Fabric loadSnapshot.
      let snapshot = initial
      for (let i = 0; i < 3; i++) {
        engine.loadSnapshot(snapshot)
        snapshot = engine.toSnapshot()
      }

      const finalBin = snapshot.groups.find((g) => g.id === 'bin')!
      const finalRect = snapshot.shapes.find((s) => s.id === 'r1')!
      expect(finalBin.x).toBeCloseTo(0, 0)
      expect(finalBin.y).toBeCloseTo(84, 0)
      expect(finalBin.width).toBe(84)
      expect(finalBin.height).toBe(84)
      expect(finalRect.x).toBeCloseTo(-2, 0)
      expect(finalRect.y).toBeCloseTo(-2, 0)
      expect(finalRect.groupId).toBe('bin')
    })
  })

  // ─── C9-C11: Selection ──────────────────────────────────────────────────────

  describe('Selection', () => {
    it('C9: select([id1, id2]) → getSelectedIds returns both', () => {
      engine.addShape(makeRect({ id: 'a' }))
      engine.addShape(makeCircle({ id: 'b' }))
      engine.select(['a', 'b'])
      const ids = engine.getSelectedIds().sort()
      expect(ids).toEqual(['a', 'b'])
    })

    it('C10: clearSelection → getSelectedIds returns []', () => {
      engine.addShape(makeRect({ id: 'a' }))
      engine.select(['a'])
      engine.clearSelection()
      expect(engine.getSelectedIds()).toEqual([])
    })

    it('C11: selection change emits selectionChanged event', () => {
      const handler = vi.fn()
      engine.on('selectionChanged', handler)
      engine.addShape(makeRect({ id: 'a' }))
      engine.select(['a'])
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ ids: expect.arrayContaining(['a']) })
      )
    })
  })

  // ─── C12-C14: Viewport ─────────────────────────────────────────────────────

  describe('Viewport', () => {
    it('C12: panTo(50, 50) → getViewport returns correct pan', () => {
      engine.panTo(50, 50)
      const vp = engine.getViewport()
      expect(vp.panX).toBe(50)
      expect(vp.panY).toBe(50)
    })

    it('C13: zoomTo(2) → getViewport().zoom === 2', () => {
      engine.zoomTo(2)
      expect(engine.getViewport().zoom).toBe(2)
    })

    it('C14: resetView → origin at bottom-left, zoom derived from grid size', () => {
      engine.panTo(100, 200)
      engine.zoomTo(3)
      engine.resetView()
      const vp = engine.getViewport()
      // zoom = 64 / gridSize, independent of viewport dimensions
      const gs = 42
      const expectedZoom = 64 / gs
      const expectedPad = 1.5 * gs * expectedZoom // = 96
      expect(vp.zoom).toBeCloseTo(expectedZoom, 2)
      expect(vp.panX).toBeCloseTo(-expectedPad, 0)
      expect(vp.panY).toBeCloseTo(-(600 - expectedPad), 0)
    })

    it('C24: setViewportInsets shifts origin but zoom stays the same', () => {
      engine.setViewportInsets({ left: 200 })
      engine.resetView()
      const vp = engine.getViewport()
      // zoom still = 64/42, only origin x shifts by the inset
      const gs = 42
      const expectedZoom = 64 / gs
      const expectedPad = 1.5 * gs * expectedZoom
      expect(vp.zoom).toBeCloseTo(expectedZoom, 2)
      expect(vp.panX).toBeCloseTo(-(200 + expectedPad), 0)
      expect(vp.panY).toBeCloseTo(-(600 - expectedPad), 0)
    })

    it('C25: resetView zoom scales with grid size, not viewport', () => {
      engine.setGridConfig({ size: 80 })
      engine.resetView()
      const vp = engine.getViewport()
      // zoom = 64/80 = 0.8, pad = 1.5 * 80 * 0.8 = 96
      const gs = 80
      const expectedZoom = 64 / gs
      const expectedPad = 1.5 * gs * expectedZoom
      expect(vp.zoom).toBeCloseTo(expectedZoom, 2)
      expect(vp.panX).toBeCloseTo(-expectedPad, 0)
      expect(vp.panY).toBeCloseTo(-(600 - expectedPad), 0)
    })
  })

  // ─── C17-C19: Events ───────────────────────────────────────────────────────

  describe('Events', () => {
    it('C17: addShape emits shapeCreated', () => {
      const handler = vi.fn()
      engine.on('shapeCreated', handler)
      const rect = makeRect()
      engine.addShape(rect)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ shape: expect.objectContaining({ id: 'rect-1' }) })
      )
    })

    it('C18: removeShape emits shapeDeleted', () => {
      const handler = vi.fn()
      engine.on('shapeDeleted', handler)
      engine.addShape(makeRect())
      engine.removeShape('rect-1')
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'rect-1' }))
    })

    it('C19: on() returns unsubscribe that stops delivery', () => {
      const handler = vi.fn()
      const unsub = engine.on('shapeCreated', handler)
      unsub()
      engine.addShape(makeRect())
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ─── C20-C21: Lifecycle ─────────────────────────────────────────────────────

  describe('Lifecycle', () => {
    it('C20: dispose is idempotent — calling twice does not throw', () => {
      expect(() => {
        engine.dispose()
        engine.dispose()
      }).not.toThrow()
    })

    it('C21: after dispose, no events are emitted', () => {
      const handler = vi.fn()
      engine.on('shapeCreated', handler)
      engine.dispose()
      // After dispose, addShape may throw or no-op, but handler must not be called
      try {
        engine.addShape(makeRect())
      } catch {
        // Expected — some engines may throw after dispose
      }
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ─── C15-C16: Serialization ─────────────────────────────────────────────────

  describe('Serialization', () => {
    it('C15: toSnapshot → loadSnapshot roundtrip preserves shapes and groups', () => {
      const rect = makeRect({ id: 'r1' })
      const circle = makeCircle({ id: 'c1' })
      engine.addShape(rect)
      engine.addShape(circle)
      engine.createGroup(makeGroup({ id: 'g1', childIds: ['r1', 'c1'] }))

      const snapshot = engine.toSnapshot()

      // Clear and reload
      engine.removeGroup('g1')
      engine.removeShape('r1')
      engine.removeShape('c1')
      expect(engine.getAllShapes()).toHaveLength(0)

      engine.loadSnapshot(snapshot)

      const shapes = engine.getAllShapes()
      expect(shapes).toHaveLength(2)
      expect(shapes.map((s) => s.id).sort()).toEqual(['c1', 'r1'])

      const groups = engine.getAllGroups()
      expect(groups).toHaveLength(1)
      expect(groups[0].childIds.sort()).toEqual(['c1', 'r1'])
    })

    it('C16: snapshot contains no engine-specific properties', () => {
      engine.addShape(makeRect({ id: 'r1' }))
      const snapshot = engine.toSnapshot()

      // Snapshot should only have known keys
      expect(Object.keys(snapshot).sort()).toEqual(['gridConfig', 'groups', 'shapes', 'version'])

      // Each shape should only have LayoutShape keys
      for (const shape of snapshot.shapes) {
        const keys = Object.keys(shape)
        // Must not contain fabric/konva internals
        expect(keys).not.toContain('_objects')
        expect(keys).not.toContain('canvas')
        expect(keys).not.toContain('__eventListeners')
        expect(keys).not.toContain('attrs')
        expect(keys).not.toContain('className')
      }
    })
  })

  // ─── C26-C32: Resize & Collision ──────────────────────────────────────────

  describe('Resize & Collision', () => {
    it('C26: updateGroup with new width/height updates dimensions', () => {
      const g = makeGroup({ id: 'g-resize', x: 0, y: 168, width: 168, height: 168 })
      engine.createGroup(g)
      engine.updateGroup('g-resize', { width: 252, height: 84 })
      const updated = engine.getGroup('g-resize')!
      expect(updated.width).toBe(252)
      expect(updated.height).toBe(84)
    })

    it('C27: updateGroup resize preserves lower-left x when growing right', () => {
      const g = makeGroup({ id: 'g-grow', x: 84, y: 168, width: 168, height: 168 })
      engine.createGroup(g)
      engine.updateGroup('g-grow', { width: 252 })
      const updated = engine.getGroup('g-grow')!
      // x (lower-left) stays at 84
      expect(updated.x).toBeCloseTo(84, 0)
    })

    it('C28: checkGroupCollision detects overlap', () => {
      const groups: LayoutGroup[] = [
        makeGroup({ id: 'a', x: 0, y: 168, width: 168, height: 168 }),
        makeGroup({ id: 'b', x: 210, y: 168, width: 168, height: 168 })
      ]
      const collider = checkGroupCollision({ x: 210, y: 168, width: 168, height: 168 }, 'a', groups)
      expect(collider).toBe('b')
    })

    it('C29: checkGroupCollision returns null when no overlap', () => {
      const groups: LayoutGroup[] = [
        makeGroup({ id: 'a', x: 0, y: 168, width: 168, height: 168 }),
        makeGroup({ id: 'b', x: 210, y: 168, width: 168, height: 168 })
      ]
      const collider = checkGroupCollision({ x: 0, y: 420, width: 168, height: 168 }, 'a', groups)
      expect(collider).toBeNull()
    })

    it('C30: checkGroupCollision ignores self', () => {
      const groups: LayoutGroup[] = [makeGroup({ id: 'a', x: 0, y: 168, width: 168, height: 168 })]
      const collider = checkGroupCollision({ x: 0, y: 168, width: 168, height: 168 }, 'a', groups)
      expect(collider).toBeNull()
    })

    it('C31: touching edges do not collide', () => {
      const groups: LayoutGroup[] = [
        makeGroup({ id: 'a', x: 0, y: 168, width: 168, height: 168 }),
        makeGroup({ id: 'b', x: 168, y: 168, width: 168, height: 168 })
      ]
      const collider = checkGroupCollision({ x: 0, y: 168, width: 168, height: 168 }, 'a', groups)
      expect(collider).toBeNull()
    })

    it('C32: resize expansion into neighbor detects collision', () => {
      const groups: LayoutGroup[] = [
        makeGroup({ id: 'a', x: 0, y: 168, width: 168, height: 168 }),
        makeGroup({ id: 'b', x: 168, y: 168, width: 168, height: 168 })
      ]
      const collider = checkGroupCollision({ x: 0, y: 168, width: 169, height: 168 }, 'a', groups)
      expect(collider).toBe('b')
    })
  })

  // ─── Hierarchy invariants ──────────────────────────────────────────────────

  /**
   * Asserts the inverse-mapping invariant: every shape's `groupId` matches
   * exactly one group's `childIds` (or is null), and every entry in a group's
   * `childIds` references a shape whose `groupId` points back at that group.
   */
  function assertHierarchyConsistent(eng: LayoutEngine): void {
    const shapes = eng.getAllShapes()
    const groups = eng.getAllGroups()
    const shapeById = new Map(shapes.map((s) => [s.id, s]))
    const groupById = new Map(groups.map((g) => [g.id, g]))

    for (const shape of shapes) {
      if (shape.groupId !== null) {
        const parent = groupById.get(shape.groupId)
        expect(parent, `shape ${shape.id} references missing group ${shape.groupId}`).toBeDefined()
        expect(parent!.childIds, `group ${parent!.id}.childIds missing ${shape.id}`).toContain(
          shape.id
        )
      }
    }

    for (const group of groups) {
      // No duplicate childIds within a group
      expect(new Set(group.childIds).size, `group ${group.id} has duplicate childIds`).toBe(
        group.childIds.length
      )

      for (const childId of group.childIds) {
        const child = shapeById.get(childId)
        expect(child, `group ${group.id}.childIds → missing shape ${childId}`).toBeDefined()
        expect(child!.groupId, `shape ${childId}.groupId does not point back at ${group.id}`).toBe(
          group.id
        )
      }
    }

    // No shape appears in more than one group's childIds
    const seen = new Set<string>()
    for (const group of groups) {
      for (const childId of group.childIds) {
        expect(seen.has(childId), `${childId} listed in multiple groups`).toBe(false)
        seen.add(childId)
      }
    }
  }

  describe('Hierarchy invariants', () => {
    it('H1: empty engine is consistent', () => {
      assertHierarchyConsistent(engine)
    })

    it('H2: lone shape with no group is consistent', () => {
      engine.addShape(makeRect({ id: 's1' }))
      assertHierarchyConsistent(engine)
    })

    it('H3: lone group with no children is consistent', () => {
      engine.createGroup(makeGroup({ id: 'g1' }))
      assertHierarchyConsistent(engine)
    })

    it('H4: createGroup with childIds populates inverse mapping', () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.addShape(makeCircle({ id: 's2' }))
      engine.createGroup(makeGroup({ id: 'g1', childIds: ['s1', 's2'] }))
      assertHierarchyConsistent(engine)
    })

    it('H5: addToGroup keeps invariants', () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.createGroup(makeGroup({ id: 'g1' }))
      engine.addToGroup('s1', 'g1')
      assertHierarchyConsistent(engine)
    })

    it('H6: removeFromGroup keeps invariants', () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.createGroup(makeGroup({ id: 'g1', childIds: ['s1'] }))
      engine.removeFromGroup('s1')
      assertHierarchyConsistent(engine)
    })

    it("H7: removeShape from a group cleans the parent's childIds", () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.createGroup(makeGroup({ id: 'g1', childIds: ['s1'] }))
      engine.removeShape('s1')
      assertHierarchyConsistent(engine)
      const g = engine.getGroup('g1')!
      expect(g.childIds).not.toContain('s1')
    })

    it('H8: removeGroup detaches children to top-level (consistent state)', () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.addShape(makeCircle({ id: 's2' }))
      engine.createGroup(makeGroup({ id: 'g1', childIds: ['s1', 's2'] }))
      engine.removeGroup('g1')
      assertHierarchyConsistent(engine)
      // Children survive but become top-level
      expect(engine.getShape('s1')!.groupId).toBeNull()
      expect(engine.getShape('s2')!.groupId).toBeNull()
    })

    it('H9: reparenting A → B keeps invariants (regression: childIds was leaking)', () => {
      engine.addShape(makeRect({ id: 's1' }))
      engine.createGroup(makeGroup({ id: 'a', x: 0, y: 100, width: 100, height: 100 }))
      engine.createGroup(makeGroup({ id: 'b', x: 200, y: 100, width: 100, height: 100 }))
      engine.addToGroup('s1', 'a')
      engine.addToGroup('s1', 'b')
      assertHierarchyConsistent(engine)
      // Specifically: s1 must be in B's childIds, NOT in A's
      expect(engine.getGroup('a')!.childIds).not.toContain('s1')
      expect(engine.getGroup('b')!.childIds).toContain('s1')
    })

    it('H10: invariants hold after a randomized op sequence', () => {
      // Deterministic pseudo-random sequence — a smoke fuzz that exercises a
      // mix of ops and asserts the invariant after every step.
      engine.createGroup(makeGroup({ id: 'g1', x: 0, y: 100, width: 100, height: 100 }))
      engine.createGroup(makeGroup({ id: 'g2', x: 200, y: 100, width: 100, height: 100 }))

      const ops: Array<() => void> = [
        () => engine.addShape(makeRect({ id: 's1' })),
        () => engine.addShape(makeCircle({ id: 's2' })),
        () => engine.addShape(makeRect({ id: 's3' })),
        () => engine.addToGroup('s1', 'g1'),
        () => engine.addToGroup('s2', 'g1'),
        () => engine.addToGroup('s3', 'g2'),
        () => engine.addToGroup('s1', 'g2'), // A → B
        () => engine.removeFromGroup('s2'),
        () => engine.addToGroup('s2', 'g2'),
        () => engine.removeShape('s3'),
        () => engine.removeGroup('g1'),
        () => engine.addShape(makeRect({ id: 's4' })),
        () => engine.createGroup(makeGroup({ id: 'g3', x: 400, y: 100, width: 100, height: 100 })),
        () => engine.addToGroup('s4', 'g3'),
        () => engine.removeFromGroup('s4')
      ]

      for (const op of ops) {
        op()
        assertHierarchyConsistent(engine)
      }
    })
  })
})

// ─── Cross-Engine Roundtrip Tests ─────────────────────────────────────────────

describe('Cross-engine snapshot roundtrip', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = makeContainer()
  })

  afterEach(() => {
    container.remove()
  })

  it('Fabric → Konva: snapshot preserves all shapes and groups', () => {
    const fabricEngine = createLayoutEngine('fabric')
    fabricEngine.mount(container)

    fabricEngine.addShape(makeRect({ id: 'r1' }))
    fabricEngine.addShape(makeCircle({ id: 'c1' }))
    fabricEngine.addShape(makePolygon({ id: 'p1' }))
    fabricEngine.createGroup(makeGroup({ id: 'g1', childIds: ['r1', 'c1'] }))

    const snapshot = fabricEngine.toSnapshot()
    fabricEngine.dispose()

    // Load into Konva
    const konvaEngine = createLayoutEngine('konva')
    konvaEngine.mount(container)
    konvaEngine.loadSnapshot(snapshot)

    const shapes = konvaEngine.getAllShapes()
    expect(shapes).toHaveLength(3)
    expect(shapes.map((s) => s.id).sort()).toEqual(['c1', 'p1', 'r1'])

    const groups = konvaEngine.getAllGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('g1')
    expect(groups[0].childIds.sort()).toEqual(['c1', 'r1'])

    konvaEngine.dispose()
  })

  it('Fabric → Konva → Fabric: polygon position preserved (bbox center convention)', () => {
    // Asymmetric triangle: bbox center = (50, 40), centroid ≠ bbox center.
    // Regression test for #252 — polygon drift when switching engines.
    const fabricEngine = createLayoutEngine('fabric')
    fabricEngine.mount(container)

    fabricEngine.addShape(makePolygon({ id: 'asym', x: 200, y: 150 }))

    const origShape = fabricEngine.getShape('asym')!
    const origX = origShape.x
    const origY = origShape.y

    // Fabric → Konva
    const snap1 = fabricEngine.toSnapshot()
    fabricEngine.dispose()

    const konvaEngine = createLayoutEngine('konva')
    konvaEngine.mount(container)
    konvaEngine.loadSnapshot(snap1)

    const konvaShape = konvaEngine.getShape('asym')!
    expect(konvaShape.x).toBeCloseTo(origX, 1)
    expect(konvaShape.y).toBeCloseTo(origY, 1)

    // Konva → Fabric
    const snap2 = konvaEngine.toSnapshot()
    konvaEngine.dispose()

    const fabricEngine2 = createLayoutEngine('fabric')
    fabricEngine2.mount(container)
    fabricEngine2.loadSnapshot(snap2)

    const finalShape = fabricEngine2.getShape('asym')!
    expect(finalShape.x).toBeCloseTo(origX, 1)
    expect(finalShape.y).toBeCloseTo(origY, 1)

    fabricEngine2.dispose()
  })

  it('Konva → Fabric: snapshot preserves all shapes and groups', () => {
    const konvaEngine = createLayoutEngine('konva')
    konvaEngine.mount(container)

    konvaEngine.addShape(makeRect({ id: 'r1' }))
    konvaEngine.addShape(makeCircle({ id: 'c1' }))
    konvaEngine.addShape(makePolygon({ id: 'p1' }))
    konvaEngine.createGroup(makeGroup({ id: 'g1', childIds: ['r1', 'c1'] }))

    const snapshot = konvaEngine.toSnapshot()
    konvaEngine.dispose()

    // Load into Fabric
    const fabricEngine = createLayoutEngine('fabric')
    fabricEngine.mount(container)
    fabricEngine.loadSnapshot(snapshot)

    const shapes = fabricEngine.getAllShapes()
    expect(shapes).toHaveLength(3)
    expect(shapes.map((s) => s.id).sort()).toEqual(['c1', 'p1', 'r1'])

    const groups = fabricEngine.getAllGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('g1')
    expect(groups[0].childIds.sort()).toEqual(['c1', 'r1'])

    fabricEngine.dispose()
  })
})
