/**
 * @vitest-environment jsdom
 *
 * Dropping a multi-selection: each shape goes to the bin its own center is in, and the move
 * and the reassignment are one change. Konva's drag is not driven here: the nodes are moved
 * as the drag would move them, then each node's own dragend is fired.
 */
import 'vitest-canvas-mock'

globalThis.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { KonvaEngine } from '../konva-engine'
import { UndoRedoStack } from '../undo-redo-stack'
import type { LayoutGroup, LayoutShape } from '../types'

/** A 2×2 bin whose lower-left corner is at (0, 84): it covers x 0..84 and y 0..84. */
function makeBin(): LayoutGroup {
  return {
    id: 'bin',
    x: 0,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { fill: 'rgba(96, 165, 250, 0.05)', stroke: '#60a5fa', strokeWidth: 1 },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: 'Bin 1' }
  }
}

/** A 10 by 10 rectangle at world (x, 40). */
function makeRect(id: string, x: number): LayoutShape {
  return {
    id,
    type: 'rect',
    x,
    y: 40,
    width: 10,
    height: 10,
    rotation: 0,
    fill: '#bbbbbb',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null
  } as LayoutShape
}

interface EngineInternals {
  konvaMap: Map<string, Konva.Shape>
}

describe('dropping a multi-selection', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement

  const node = (id: string): Konva.Shape => (engine as unknown as EngineInternals).konvaMap.get(id)!
  const snapshot = (): string => JSON.stringify(engine.toSnapshot())
  /** Drag every selected shape by the same offset and let go, as Konva does. */
  const dragSelection = (ids: string[], dx: number): void => {
    node(ids[0]).fire('dragstart')
    for (const id of ids) node(id).x(node(id).x() + dx)
    for (const id of ids) node(id).fire('dragend')
  }
  const world = (id: string): { x: number; y: number } => {
    const b = engine.getShapeBounds(id)!
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
  }

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = new KonvaEngine()
    engine.mount(container)
    engine.createGroup(makeBin())
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  it('puts every dropped shape in the bin it lands in', () => {
    engine.addShape(makeRect('a', 200))
    engine.addShape(makeRect('b', 230))
    engine.select(['a', 'b'])
    const before = { a: world('a'), b: world('b') }

    // a lands at x 20, b at x 50: both inside the bin.
    dragSelection(['a', 'b'], -180)

    expect(engine.getShape('a')!.groupId).toBe('bin')
    expect(engine.getShape('b')!.groupId).toBe('bin')
    expect(engine.getGroup('bin')!.childIds.sort()).toEqual(['a', 'b'])
    expect(world('a').x).toBeCloseTo(before.a.x - 180, 6)
    expect(world('b').x).toBeCloseTo(before.b.x - 180, 6)
  })

  it('assigns each shape by its own center, not the selection as a whole', () => {
    engine.addShape(makeRect('a', 40))
    engine.addShape(makeRect('b', 100))
    engine.select(['a', 'b'])

    // a stays in the bin at x 40; b is outside, at x 100.
    dragSelection(['a', 'b'], 10)

    expect(engine.getShape('a')!.groupId).toBe('bin')
    expect(engine.getShape('b')!.groupId).toBeNull()
  })

  it('releases shapes dragged out of a bin', () => {
    engine.addShape(makeRect('a', 20))
    engine.addShape(makeRect('b', 50))
    engine.addToGroup('a', 'bin')
    engine.addToGroup('b', 'bin')
    engine.select(['a', 'b'])
    const before = { a: world('a'), b: world('b') }

    dragSelection(['a', 'b'], 200)

    expect(engine.getShape('a')!.groupId).toBeNull()
    expect(engine.getShape('b')!.groupId).toBeNull()
    expect(engine.getGroup('bin')!.childIds).toEqual([])
    expect(world('a').x).toBeCloseTo(before.a.x + 200, 6)
    expect(world('b').x).toBeCloseTo(before.b.x + 200, 6)
  })

  it('is one undo step for the move and the reassignment together', () => {
    engine.addShape(makeRect('a', 200))
    engine.addShape(makeRect('b', 230))
    engine.select(['a', 'b'])
    const history = new UndoRedoStack()
    history.init(snapshot())
    const steps: string[] = []
    for (const name of ['shapeMoved', 'shapeResized', 'shapeUpdated', 'groupChanged'] as const) {
      engine.on(name, () => {
        if (history.push(snapshot(), name)) steps.push(name)
      })
    }

    dragSelection(['a', 'b'], -180)

    expect(steps).toHaveLength(1)
    engine.loadSnapshot(JSON.parse(history.undo()!))
    expect(engine.getGroup('bin')!.childIds).toEqual([])
    expect(engine.getShape('a')!.groupId).toBeNull()
    expect(engine.getShape('b')!.groupId).toBeNull()
    expect(engine.getShape('a')!.x).toBe(200)
  })
})
