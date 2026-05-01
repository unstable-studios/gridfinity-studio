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
 * Coordinate-system invariants for the LayoutEngine interface.
 *
 * The convention every adapter must uphold:
 *   - `LayoutGroup.x, y` is the LOWER-LEFT corner in world space (smallest x,
 *     largest screen-y).
 *   - The bin spans world x ∈ [x, x+width], y ∈ [y-height, y].
 *   - Centroid is (x + width/2, y - height/2).
 *
 * Children of a group store coords RELATIVE to the parent's centroid.
 * World position of a child shape is therefore:
 *     (group.x + group.width/2 + shape.x, group.y - group.height/2 + shape.y)
 *
 * The `layout-engine.contract.test.ts` file already covers a few specific
 * regressions (#279, #281, #285) — this file covers the broader invariants
 * that the engines must uphold for any combination of move/resize/snapshot.
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

function childWorld(shape: LayoutShape, group: LayoutGroup): { x: number; y: number } {
  return {
    x: group.x + group.width / 2 + shape.x,
    y: group.y - group.height / 2 + shape.y
  }
}

// ─── Per-engine contract ───────────────────────────────────────────────────

const engineTypes = ['fabric', 'konva'] as const

describe.each(engineTypes)('LayoutEngine coord invariants (%s)', (engineType) => {
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

  // ─── Lower-left convention sanity ───────────────────────────────────────

  describe('lower-left convention', () => {
    it('createGroup → getGroup returns identical x/y', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 7, y: 121, width: 84, height: 84 }))
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(7, 0)
      expect(g.y).toBeCloseTo(121, 0)
      expect(g.width).toBe(84)
      expect(g.height).toBe(84)
    })

    it('centroid math (x + w/2, y - h/2) holds for arbitrary positions', () => {
      const cases = [
        { x: 0, y: 100, w: 100, h: 100 },
        { x: -50, y: 0, w: 50, h: 50 },
        { x: 200, y: 84, w: 168, h: 84 },
        { x: 7.5, y: 33.5, w: 21, h: 21 }
      ]
      for (const [i, c] of cases.entries()) {
        const id = `c-${i}`
        engine.createGroup(makeGroup({ id, x: c.x, y: c.y, width: c.w, height: c.h }))
        const g = engine.getGroup(id)!
        const cx = g.x + g.width / 2
        const cy = g.y - g.height / 2
        expect(cx).toBeCloseTo(c.x + c.w / 2, 1)
        expect(cy).toBeCloseTo(c.y - c.h / 2, 1)
      }
    })

    it('getGroup matches getAllGroups for the same id', () => {
      engine.createGroup(makeGroup({ id: 'a', x: 0, y: 100, width: 100, height: 100 }))
      engine.createGroup(makeGroup({ id: 'b', x: 200, y: 100, width: 50, height: 80 }))
      const all = engine.getAllGroups()
      const aDirect = engine.getGroup('a')!
      const aFromAll = all.find((g) => g.id === 'a')!
      expect(aFromAll.x).toBeCloseTo(aDirect.x, 1)
      expect(aFromAll.y).toBeCloseTo(aDirect.y, 1)
      expect(aFromAll.width).toBe(aDirect.width)
      expect(aFromAll.height).toBe(aDirect.height)
    })
  })

  // ─── Move (updateGroup x/y) keeps children world-stable ─────────────────

  describe('move bin (updateGroup x/y)', () => {
    it('updateGroup({ x }) without children moves only x', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 0, y: 100, width: 100, height: 100 }))
      engine.updateGroup('g', { x: 50 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(100, 0)
      expect(g.width).toBe(100)
      expect(g.height).toBe(100)
    })

    it('updateGroup({ y }) without children moves only y', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 0, y: 100, width: 100, height: 100 }))
      engine.updateGroup('g', { y: 200 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(0, 0)
      expect(g.y).toBeCloseTo(200, 0)
    })

    it('moving a bin preserves children world positions', () => {
      const bin = makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 })
      // Child at world (40, 60) → local (-10, 10) since centroid is (50, 50)
      const child = makeRect({ id: 'r1', x: -10, y: 10, width: 20, height: 20, groupId: 'bin' })
      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(child)

      const beforeChild = engine.getShape('r1')!
      const beforeBin = engine.getGroup('bin')!
      const beforeWorld = childWorld(beforeChild, beforeBin)

      // Move bin
      engine.updateGroup('bin', { x: 200, y: 300 })

      const afterChild = engine.getShape('r1')!
      const afterBin = engine.getGroup('bin')!
      const afterWorld = childWorld(afterChild, afterBin)

      // Child moved with the bin: world delta should match the bin's delta
      expect(afterWorld.x - beforeWorld.x).toBeCloseTo(200 - 0, 0)
      expect(afterWorld.y - beforeWorld.y).toBeCloseTo(300 - 100, 0)
    })
  })

  // ─── Resize (updateGroup width/height) keeps x/y stable ─────────────────

  describe('resize bin (updateGroup width/height)', () => {
    it('updateGroup({ width }) only — x/y/height unchanged', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 50, y: 200, width: 100, height: 100 }))
      engine.updateGroup('g', { width: 168 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(200, 0)
      expect(g.width).toBe(168)
      expect(g.height).toBe(100)
    })

    it('updateGroup({ height }) only — x/y/width unchanged', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 50, y: 200, width: 100, height: 100 }))
      engine.updateGroup('g', { height: 168 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(200, 0)
      expect(g.width).toBe(100)
      expect(g.height).toBe(168)
    })

    it('updateGroup({ width, height }) — x/y unchanged when both grow', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 50, y: 200, width: 100, height: 100 }))
      engine.updateGroup('g', { width: 150, height: 175 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(200, 0)
    })

    it('updateGroup({ width, height }) — x/y unchanged when shrinking', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 50, y: 200, width: 100, height: 100 }))
      engine.updateGroup('g', { width: 50, height: 50 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(200, 0)
      expect(g.width).toBe(50)
      expect(g.height).toBe(50)
    })

    it('shrinking a bin keeps a still-contained child at the same world position', () => {
      const bin = makeGroup({ id: 'bin', x: 0, y: 200, width: 200, height: 200 })
      // Child at world (90, 110) → local (-10, 10) since centroid is (100, 100)
      const child = makeRect({ id: 'r1', x: -10, y: 10, width: 20, height: 20, groupId: 'bin' })
      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(child)

      const beforeWorld = childWorld(engine.getShape('r1')!, engine.getGroup('bin')!)
      engine.updateGroup('bin', { width: 120, height: 140 })
      const afterWorld = childWorld(engine.getShape('r1')!, engine.getGroup('bin')!)

      expect(afterWorld.x).toBeCloseTo(beforeWorld.x, 0)
      expect(afterWorld.y).toBeCloseTo(beforeWorld.y, 0)
    })
  })

  // ─── Move + resize compose ──────────────────────────────────────────────

  describe('combined move + resize', () => {
    it('updateGroup({ x, y, width, height }) applies all four', () => {
      engine.createGroup(makeGroup({ id: 'g', x: 0, y: 100, width: 100, height: 100 }))
      engine.updateGroup('g', { x: 50, y: 200, width: 150, height: 175 })
      const g = engine.getGroup('g')!
      expect(g.x).toBeCloseTo(50, 0)
      expect(g.y).toBeCloseTo(200, 0)
      expect(g.width).toBe(150)
      expect(g.height).toBe(175)
    })

    it('sequential updateGroup calls do not accumulate drift', () => {
      const id = 'g'
      engine.createGroup(makeGroup({ id, x: 0, y: 100, width: 100, height: 100 }))
      // 20 small moves each cancelled by an opposite move — should land at origin.
      for (let i = 0; i < 20; i++) {
        engine.updateGroup(id, { x: 0.5 })
        engine.updateGroup(id, { x: 0 })
      }
      const g = engine.getGroup(id)!
      expect(g.x).toBeCloseTo(0, 1)
      expect(g.y).toBeCloseTo(100, 1)
      expect(g.width).toBe(100)
      expect(g.height).toBe(100)
    })
  })

  // ─── Snapshot round-trip precision ──────────────────────────────────────

  describe('snapshot round-trip precision', () => {
    it('group x/y/width/height survive 10 round-trips without drift', () => {
      const bin = makeGroup({ id: 'bin', x: 7, y: 121, width: 84, height: 84 })
      const rect = makeRect({ id: 'r1', x: -2, y: 2, width: 20, height: 20, groupId: 'bin' })
      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(rect)

      let snap = engine.toSnapshot()
      for (let i = 0; i < 10; i++) {
        engine.loadSnapshot(snap)
        snap = engine.toSnapshot()
      }

      const finalBin = snap.groups.find((g) => g.id === 'bin')!
      const finalRect = snap.shapes.find((s) => s.id === 'r1')!
      expect(finalBin.x).toBeCloseTo(7, 1)
      expect(finalBin.y).toBeCloseTo(121, 1)
      expect(finalBin.width).toBe(84)
      expect(finalBin.height).toBe(84)
      expect(finalRect.x).toBeCloseTo(-2, 1)
      expect(finalRect.y).toBeCloseTo(2, 1)
      expect(finalRect.groupId).toBe('bin')
    })

    it('top-level shape x/y survive 10 round-trips without drift', () => {
      engine.addShape(makeRect({ id: 'r1', x: 33.5, y: -27.5, width: 20, height: 20 }))

      let snap = engine.toSnapshot()
      for (let i = 0; i < 10; i++) {
        engine.loadSnapshot(snap)
        snap = engine.toSnapshot()
      }

      const finalRect = snap.shapes.find((s) => s.id === 'r1')!
      expect(finalRect.x).toBeCloseTo(33.5, 1)
      expect(finalRect.y).toBeCloseTo(-27.5, 1)
    })
  })

  // ─── World ↔ local conversion at the boundary ───────────────────────────

  describe('world ↔ local conversion for grouped shapes', () => {
    it('a child added at known world coords retrieves to those world coords', () => {
      const bin = makeGroup({ id: 'bin', x: 100, y: 200, width: 80, height: 80 })
      // Bin centroid is (140, 160). Place child at world (130, 170) → local (-10, 10).
      engine.createGroup(bin)
      engine.addShape(makeRect({ id: 'r1', x: -10, y: 10, width: 10, height: 10, groupId: 'bin' }))

      const stored = engine.getShape('r1')!
      const got = engine.getGroup('bin')!
      const world = childWorld(stored, got)
      expect(world.x).toBeCloseTo(130, 0)
      expect(world.y).toBeCloseTo(170, 0)
    })

    it('moving a parent and reading the child retains world consistency', () => {
      const bin = makeGroup({ id: 'bin', x: 0, y: 100, width: 100, height: 100 })
      const child = makeRect({ id: 'r1', x: -25, y: 25, width: 10, height: 10, groupId: 'bin' })
      engine.createGroup({ ...bin, childIds: ['r1'] })
      engine.addShape(child)

      // World position before move: (25, 75)
      const before = childWorld(engine.getShape('r1')!, engine.getGroup('bin')!)
      expect(before.x).toBeCloseTo(25, 0)
      expect(before.y).toBeCloseTo(75, 0)

      engine.updateGroup('bin', { x: 100 })
      const after = childWorld(engine.getShape('r1')!, engine.getGroup('bin')!)
      expect(after.x).toBeCloseTo(125, 0) // shifted by +100
      expect(after.y).toBeCloseTo(75, 0) // y unchanged
    })
  })
})
