/**
 * @vitest-environment jsdom
 *
 * Resizing a bin: shapes whose center is inside it afterward belong to it, and the rest
 * do not, by the same rule as a drop. The handles can't be driven through the LayoutEngine
 * interface, so these tests scale the bin's Konva node as a handle would and fire the
 * transformer's own end event.
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

/** A 10 by 10 rectangle whose top-left corner is at world (x, 40). */
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
  transformer: Konva.Transformer
}

describe('resizing a bin', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement

  const internals = (): EngineInternals => engine as unknown as EngineInternals
  const snapshot = (): string => JSON.stringify(engine.toSnapshot())
  /**
   * Drag the right-hand handle of the bin so its width is scaled by `factor`. The node's
   * center moves with the dragged edge, which keeps the left edge in place.
   */
  const resizeBin = (factor: number): void => {
    engine.select(['bin'])
    const binNode = internals().transformer.nodes()[0]
    const { x, width } = engine.getGroup('bin')!
    binNode.fire('transformstart')
    internals().transformer.fire('transformstart')
    binNode.scaleX(factor)
    binNode.x(x + (width * factor) / 2)
    binNode.fire('transform')
    const transformer = internals().transformer as Konva.Transformer & { _transforming: boolean }
    transformer._transforming = true
    transformer.stopTransform()
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

  it('releases a shape the smaller bin no longer covers, and takes it back when it grows', () => {
    // Centered at x 60: inside the 84 wide bin, outside the 42 wide one.
    engine.addShape(makeRect('far', 60))
    engine.addToGroup('far', 'bin')
    engine.addShape(makeRect('near', 15))
    engine.addToGroup('near', 'bin')

    resizeBin(0.5)
    expect(engine.getGroup('bin')!.width).toBe(42)
    expect(engine.getShape('far')!.groupId).toBeNull()
    expect(engine.getShape('near')!.groupId).toBe('bin')
    expect(engine.getGroup('bin')!.childIds).toEqual(['near'])

    resizeBin(2)
    expect(engine.getGroup('bin')!.width).toBe(84)
    expect(engine.getShape('far')!.groupId).toBe('bin')
    expect(engine.getGroup('bin')!.childIds.sort()).toEqual(['far', 'near'])
  })

  it('takes in a loose shape the bin grows over', () => {
    // Centered at x 105: outside the 84 wide bin, inside a 168 wide one.
    engine.addShape(makeRect('loose', 100))
    const before = engine.getShapeBounds('loose')!

    resizeBin(2)

    expect(engine.getGroup('bin')!.width).toBe(168)
    expect(engine.getShape('loose')!.groupId).toBe('bin')
    expect(engine.getShapeBounds('loose')!.minX).toBeCloseTo(before.minX, 6)
  })

  it('is one undo step for the resize and the reassignment together', () => {
    engine.addShape(makeRect('loose', 100))
    const history = new UndoRedoStack()
    history.init(snapshot())
    const steps: string[] = []
    for (const name of ['groupResized', 'shapeMoved', 'shapeUpdated', 'groupChanged'] as const) {
      engine.on(name, () => {
        if (history.push(snapshot(), name)) steps.push(name)
      })
    }

    resizeBin(2)

    expect(steps).toHaveLength(1)
    engine.loadSnapshot(JSON.parse(history.undo()!))
    expect(engine.getGroup('bin')!.width).toBe(84)
    expect(engine.getGroup('bin')!.childIds).toEqual([])
    expect(engine.getShape('loose')!.groupId).toBeNull()
  })

  it('does the same through updateGroup', () => {
    engine.addShape(makeRect('loose', 100))
    engine.updateGroup('bin', { width: 168 })
    expect(engine.getShape('loose')!.groupId).toBe('bin')
    engine.updateGroup('bin', { width: 84 })
    expect(engine.getShape('loose')!.groupId).toBeNull()
  })
})
