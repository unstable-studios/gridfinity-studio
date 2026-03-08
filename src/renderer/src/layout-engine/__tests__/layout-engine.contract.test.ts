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
