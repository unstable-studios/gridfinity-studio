/**
 * @vitest-environment jsdom
 *
 * The highlight on a bin while a shape is dragged over it. A drag can't be driven through
 * the LayoutEngine interface, so these tests fire Konva's drag events on the engine's nodes.
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Konva from 'konva'
import { KonvaEngine } from '../konva-engine'
import { DROP_TARGET_STYLE } from '../konva-group-renderer'
import type { LayoutGroup, LayoutShape } from '../types'

const BIN_STYLE = { fill: 'rgba(96, 165, 250, 0.05)', stroke: '#60a5fa', strokeWidth: 1 }

function makeBin(): LayoutGroup {
  return {
    id: 'bin',
    x: 0,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { ...BIN_STYLE },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: 'Bin 1' }
  }
}

function makeShape(): LayoutShape {
  return {
    id: 'shape',
    type: 'rect',
    x: 30,
    y: 30,
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
  rendererMap: Map<string, { konvaGroup: Konva.Group; flashCollision: () => void }>
}

describe('drop-target highlight', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement

  const internals = (): EngineInternals => engine as unknown as EngineInternals
  const binBackground = (): Konva.Rect =>
    internals().rendererMap.get('bin')!.konvaGroup.findOne('.__groupBg') as Konva.Rect
  const dragOverBin = (): void => {
    internals().konvaMap.get('shape')!.fire('dragmove')
  }

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = new KonvaEngine()
    engine.mount(container)
    engine.createGroup(makeBin())
    engine.addShape(makeShape())
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
    vi.useRealTimers()
  })

  it('tints the bin while a shape is dragged over it', () => {
    dragOverBin()

    expect(binBackground().fill()).toBe(DROP_TARGET_STYLE.fill)
    expect(binBackground().strokeWidth()).toBe(DROP_TARGET_STYLE.strokeWidth)
  })

  it('puts the bin back as it was when the drag ends', () => {
    dragOverBin()
    internals().konvaMap.get('shape')!.fire('dragend')

    expect(binBackground().fill()).toBe(BIN_STYLE.fill)
    expect(binBackground().stroke()).toBe(BIN_STYLE.stroke)
    expect(binBackground().strokeWidth()).toBe(BIN_STYLE.strokeWidth)
  })

  it('clears the highlight when the dragged shape is deleted', () => {
    dragOverBin()
    engine.removeShape('shape')

    expect(binBackground().fill()).toBe(BIN_STYLE.fill)
    expect(binBackground().strokeWidth()).toBe(BIN_STYLE.strokeWidth)
  })

  it('highlights again after the project is restored in the middle of a drag', () => {
    const snapshot = engine.toSnapshot()
    dragOverBin()
    engine.loadSnapshot(snapshot)
    dragOverBin()

    expect(binBackground().fill()).toBe(DROP_TARGET_STYLE.fill)
  })

  it('keeps the highlight when a collision flash ends during the drag', () => {
    vi.useFakeTimers()
    internals().rendererMap.get('bin')!.flashCollision()
    dragOverBin()
    vi.advanceTimersByTime(500)

    expect(binBackground().stroke()).toBe(DROP_TARGET_STYLE.stroke)
    expect(binBackground().strokeWidth()).toBe(DROP_TARGET_STYLE.strokeWidth)
  })

  it('does not save the highlight with the project', () => {
    dragOverBin()

    expect(engine.toSnapshot().groups[0].style).toMatchObject(BIN_STYLE)
  })
})
