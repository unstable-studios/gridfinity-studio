/**
 * @vitest-environment jsdom
 *
 * Letting go of the handles after turning or resizing shapes. The handles can't be driven
 * through the LayoutEngine interface, so these tests change the Konva nodes as the handles
 * would and fire the transformer's own end event.
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
import type { EngineEventMap, LayoutGroup, LayoutShape } from '../types'

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

const shapeBase = {
  rotation: 0,
  fill: '#bbbbbb',
  stroke: '#000000',
  strokeWidth: 1,
  groupId: null
}

/** A rectangle outside the bin, to its right. */
function makeRect(id: string, x: number): LayoutShape {
  return { ...shapeBase, id, type: 'rect', x, y: 40, width: 10, height: 10 } as LayoutShape
}

function makePolygon(): LayoutShape {
  return {
    ...shapeBase,
    id: 'polygon',
    type: 'polygon',
    x: 200,
    y: 40,
    points: [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 0, y: 5 }
    ]
  } as LayoutShape
}

interface EngineInternals {
  konvaMap: Map<string, Konva.Shape>
  transformer: Konva.Transformer
}

const SHAPE_EVENTS = [
  'shapeMoved',
  'shapeResized',
  'shapeUpdated',
  'groupChanged',
  'shapeReassigned'
] as const satisfies ReadonlyArray<keyof EngineEventMap>

describe('the end of a transform', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement
  let events: string[]

  const internals = (): EngineInternals => engine as unknown as EngineInternals
  const node = (id: string): Konva.Shape => internals().konvaMap.get(id)!
  /** Take hold of a handle, as a press on one does. */
  const grab = (): void => {
    internals().transformer.fire('transformstart')
  }
  /**
   * Let go of the handle the way Konva does: its own end event first, then one for each
   * node, so a bin's handler runs too.
   */
  const letGo = (): void => {
    const transformer = internals().transformer as Konva.Transformer & { _transforming: boolean }
    transformer._transforming = true
    transformer.stopTransform()
  }
  const snapshot = (): string => JSON.stringify(engine.toSnapshot())

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = new KonvaEngine()
    engine.mount(container)
    engine.createGroup(makeBin())
    events = []
    for (const name of SHAPE_EVENTS) engine.on(name, () => events.push(name))
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  it('reports a turned polygon, so the turn can be undone and saved', () => {
    engine.addShape(makePolygon())
    engine.select(['polygon'])
    grab()
    node('polygon').rotation(45)
    letGo()

    expect(events).toEqual(['shapeUpdated'])
    expect(engine.getShape('polygon')!.rotation).toBe(45)
  })

  it('stores a resized polygon as bigger points', () => {
    engine.addShape(makePolygon())
    engine.select(['polygon'])
    grab()
    node('polygon').scaleX(2)
    letGo()

    expect(events).toEqual(['shapeUpdated'])
    const polygon = engine.getShape('polygon') as LayoutShape & { points: Array<{ x: number }> }
    expect(polygon.points.map((p) => p.x)).toEqual([-10, 10, 0])
  })

  it('stores a resized rectangle as a new size, not a scale', () => {
    engine.addShape(makeRect('rect', 200))
    engine.select(['rect'])
    grab()
    node('rect').scaleX(3)
    letGo()

    expect(events).toEqual(['shapeResized'])
    expect(engine.getShape('rect')).toMatchObject({ width: 30, height: 10 })
    expect(node('rect').scaleX()).toBe(1)
  })

  it('never gives a rectangle or ellipse a negative size', () => {
    engine.addShape(makeRect('rect', 200))
    engine.addShape({
      ...shapeBase,
      id: 'ellipse',
      type: 'circle',
      x: 300,
      y: 40,
      radiusX: 8,
      radiusY: 4
    } as LayoutShape)
    // A handle dragged past the opposite edge mirrors the shape.
    engine.select(['rect'])
    grab()
    node('rect').scaleX(-2)
    node('rect').fire('transform')
    letGo()
    engine.select(['ellipse'])
    grab()
    node('ellipse').scaleY(-3)
    node('ellipse').fire('transform')
    letGo()

    expect(engine.getShape('rect')).toMatchObject({ width: 20, height: 10 })
    expect(engine.getShape('ellipse')).toMatchObject({ radiusX: 8, radiusY: 12 })
    expect(node('rect').scaleX()).toBe(1)
    expect(node('ellipse').scaleY()).toBe(1)
  })

  it('takes a shape out of its bin when the transform carries it out', () => {
    engine.addShape(makeRect('rect', 40))
    engine.addToGroup('rect', 'bin')
    engine.select(['rect'])
    events.length = 0
    grab()
    // Its position is measured from the middle of the bin: this is well to the right of it.
    node('rect').x(300)
    letGo()

    expect(engine.getShape('rect')!.groupId).toBeNull()
    expect(engine.getGroup('bin')!.childIds).toEqual([])
    expect(engine.getShapeBounds('rect')!.minX).toBeCloseTo(337, 6)
    expect(engine.getShapeBounds('rect')!.maxX).toBeCloseTo(347, 6)
    expect(events).toEqual(['groupChanged', 'shapeReassigned', 'shapeResized'])
  })

  it('puts every shape of a transform in its bin before reporting any of them', () => {
    engine.addShape(makeRect('a', 200))
    engine.addShape(makeRect('b', 230))
    engine.select(['a', 'b'])
    events.length = 0
    grab()
    const binsWhenReported: Array<Array<string | null>> = []
    engine.on('shapeResized', () =>
      binsWhenReported.push([engine.getShape('a')!.groupId, engine.getShape('b')!.groupId])
    )
    node('a').x(20)
    node('b').x(50)
    letGo()

    expect(engine.getGroup('bin')!.childIds.sort()).toEqual(['a', 'b'])
    // Both were in the bin by the time the first of them was reported: one change.
    expect(binsWhenReported).toEqual([
      ['bin', 'bin'],
      ['bin', 'bin']
    ])
    // A shape's stored position is measured from its bin once it is in one.
    expect(engine.getShapeBounds('a')!.minX).toBeCloseTo(15, 6)
    expect(engine.getShapeBounds('a')!.maxX).toBeCloseTo(25, 6)
  })

  describe('resize handles', () => {
    const handles = (): string[] => [...internals().transformer.enabledAnchors()].sort()
    const corners = ['bottom-left', 'bottom-right', 'top-left', 'top-right']

    it('offers every handle for one shape, turned or not', () => {
      engine.addShape({ ...makeRect('rect', 200), rotation: 30 } as LayoutShape)
      engine.select(['rect'])
      expect(handles()).toHaveLength(8)
      expect(internals().transformer.keepRatio()).toBe(false)
    })

    it('offers every handle for several shapes that are not turned', () => {
      engine.addShape(makeRect('a', 200))
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      expect(handles()).toHaveLength(8)
      expect(internals().transformer.keepRatio()).toBe(false)
    })

    it('offers only the corners, in proportion, when one of several shapes is turned', () => {
      // Stretched along one side, the turned one would be shown as a parallelogram, which
      // is not what is stored or cut.
      engine.addShape({ ...makeRect('a', 200), rotation: 30 } as LayoutShape)
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      expect(handles()).toEqual(corners)
      expect(internals().transformer.keepRatio()).toBe(true)
    })

    it('treats a quarter turn as not turned: it only swaps width and height', () => {
      engine.addShape({ ...makeRect('a', 200), rotation: 90 } as LayoutShape)
      engine.addShape({ ...makeRect('b', 230), rotation: -180 } as LayoutShape)
      engine.select(['a', 'b'])
      expect(handles()).toHaveLength(8)
    })

    it('goes back to every handle when the turned shape leaves the selection', () => {
      engine.addShape({ ...makeRect('a', 200), rotation: 30 } as LayoutShape)
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      engine.select(['b'])
      expect(handles()).toHaveLength(8)
      expect(internals().transformer.keepRatio()).toBe(false)
    })

    it('keeps every handle while a selection turned as one is still selected', () => {
      // The handle turns every shape and the frame by the same amount, so none is turned
      // against the frame.
      engine.addShape(makeRect('a', 200))
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      grab()
      node('a').rotation(25)
      node('b').rotation(25)
      internals().transformer.rotation(25)
      letGo()
      expect(handles()).toHaveLength(8)

      // Selected afresh, the frame is square to the canvas again and both are turned
      // against it.
      engine.select(['a', 'b'])
      expect(handles()).toEqual(corners)
      expect(internals().transformer.keepRatio()).toBe(true)
    })

    it('works the handles out again when a selected shape is turned or unlocked by a change', () => {
      engine.addShape(makeRect('a', 200))
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      engine.updateShape('a', { rotation: 30 })
      expect(handles()).toEqual(corners)
      // Unlocking the ratio of one shape must not unlock a selection that needs it kept.
      engine.updateShape('a', { lockAspectRatio: false })
      expect(internals().transformer.keepRatio()).toBe(true)
      engine.updateShape('a', { rotation: 0 })
      expect(handles()).toHaveLength(8)
      expect(internals().transformer.keepRatio()).toBe(false)
    })

    it('leaves no skew on a shape when a transform ends', () => {
      engine.addShape(makeRect('a', 200))
      engine.select(['a'])
      grab()
      node('a').skewX(0.3)
      node('a').rotation(10)
      letGo()
      expect(node('a').skewX()).toBe(0)
      expect(node('a').skewY()).toBe(0)
    })

    it('gives a bin every handle, also after a turned selection', () => {
      engine.addShape({ ...makeRect('a', 200), rotation: 30 } as LayoutShape)
      engine.addShape(makeRect('b', 230))
      engine.select(['a', 'b'])
      engine.select(['bin'])
      expect(handles()).toHaveLength(8)
    })
  })

  it('leaves the shapes in a bin alone when the bin is resized', () => {
    engine.addShape(makeRect('rect', 40))
    engine.addToGroup('rect', 'bin')
    const before = engine.getShapeBounds('rect')!
    engine.select(['bin'])
    events.length = 0
    const groupEvents: string[] = []
    engine.on('groupResized', () => groupEvents.push('groupResized'))
    const binNode = internals().transformer.nodes()[0]
    binNode.fire('transformstart')
    grab()
    // Twice as wide: the bin's own handler turns this into a new size on the grid.
    binNode.scaleX(2)
    binNode.fire('transform')
    letGo()

    expect(groupEvents).toEqual(['groupResized'])
    expect(engine.getGroup('bin')!.width).toBe(168)
    expect(events.filter((name) => name.startsWith('shape'))).toEqual([])
    expect(engine.getShape('rect')!.groupId).toBe('bin')
    expect(engine.getShapeBounds('rect')!.minX).toBeCloseTo(before.minX, 6)
  })

  it('does nothing when a handle is clicked without moving it', () => {
    engine.addShape(makePolygon())
    engine.addShape(makeRect('rect', 300))
    for (const id of ['polygon', 'rect']) {
      engine.select([id])
      events.length = 0
      grab()
      letGo()
      expect(events, id).toEqual([])
    }
  })

  it('keeps a shape in its bin when it is only turned', () => {
    engine.addShape(makeRect('rect', 40))
    engine.addToGroup('rect', 'bin')
    engine.select(['rect'])
    events.length = 0
    grab()
    node('rect').rotation(30)
    letGo()

    expect(events).toEqual(['shapeResized'])
    expect(engine.getShape('rect')).toMatchObject({ groupId: 'bin', rotation: 30 })
  })

  it('is one undo step, however many shapes change bins', () => {
    engine.addShape(makeRect('a', 200))
    engine.addShape(makeRect('b', 230))
    engine.select(['a', 'b'])
    // Record a step on the events the undo history listens to.
    const history = new UndoRedoStack()
    history.init(snapshot())
    const steps: string[] = []
    for (const name of ['shapeMoved', 'shapeResized', 'shapeUpdated', 'groupChanged'] as const) {
      engine.on(name, () => {
        if (history.push(snapshot(), name)) steps.push(name)
      })
    }
    grab()
    node('a').x(20)
    node('b').x(50)
    letGo()

    expect(steps).toHaveLength(1)
    // Undoing it puts both shapes back outside the bin.
    engine.loadSnapshot(JSON.parse(history.undo()!))
    expect(engine.getGroup('bin')!.childIds).toEqual([])
    expect(engine.getShape('a')!.groupId).toBeNull()
  })

  it('keeps a turned and resized polygon through a save and reopen', () => {
    engine.addShape(makePolygon())
    engine.select(['polygon'])
    grab()
    node('polygon').rotation(45)
    node('polygon').scaleX(2)
    letGo()
    const saved = snapshot()
    engine.loadSnapshot(JSON.parse(saved))

    const polygon = engine.getShape('polygon') as LayoutShape & { points: Array<{ x: number }> }
    expect(polygon.rotation).toBe(45)
    expect(polygon.points.map((p) => p.x)).toEqual([-10, 10, 0])
    expect(snapshot()).toBe(saved)
  })
})
