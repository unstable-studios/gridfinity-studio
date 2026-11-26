/**
 * @vitest-environment jsdom
 *
 * The mark Konva draws on a bin that carries a warning. What is drawn is not part of the
 * LayoutEngine interface, so these tests look at the engine's Konva nodes.
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
import { WARNING_MARK_STYLE } from '../konva-group-renderer'
import type { LayoutGroup } from '../types'

function makeBin(): LayoutGroup {
  return {
    id: 'bin',
    x: 0,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { fill: 'rgba(96, 165, 250, 0.05)', stroke: '#60a5fa', strokeWidth: 1, cornerRadius: 4 },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: 'Bin 1' }
  }
}

interface EngineInternals {
  rendererMap: Map<string, { konvaGroup: Konva.Group }>
}

describe('warning mark', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement

  const binNode = (): Konva.Group =>
    (engine as unknown as EngineInternals).rendererMap.get('bin')!.konvaGroup
  const marks = (): Konva.Rect[] => binNode().find('.__warningMark') as Konva.Rect[]
  const background = (): Konva.Rect => binNode().findOne('.__groupBg') as Konva.Rect

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

  it('is drawn once on a warned bin, however often the warning is set', () => {
    expect(marks()).toHaveLength(0)
    engine.setGroupWarnings(['bin'])
    engine.setGroupWarnings(['bin'])
    expect(marks()).toHaveLength(1)
    expect(marks()[0].stroke()).toBe(WARNING_MARK_STYLE.stroke)
  })

  it('goes when the warning does', () => {
    engine.setGroupWarnings(['bin'])
    engine.setGroupWarnings([])
    expect(marks()).toHaveLength(0)
  })

  it('does not take clicks meant for the bin', () => {
    engine.setGroupWarnings(['bin'])
    expect(marks()[0].listening()).toBe(false)
  })

  it('sits inside the outline, so the bin is no bigger for having it', () => {
    const before = binNode().getClientRect({ skipTransform: true })
    engine.setGroupWarnings(['bin'])
    const mark = marks()[0]
    expect(mark.x()).toBeGreaterThan(background().x())
    expect(mark.y()).toBeGreaterThan(background().y())
    expect(mark.x() + mark.width()).toBeLessThan(background().x() + background().width())
    expect(mark.y() + mark.height()).toBeLessThan(background().y() + background().height())
    expect(binNode().getClientRect({ skipTransform: true })).toEqual(before)
  })

  it('keeps the bin background at the bottom', () => {
    engine.setGroupWarnings(['bin'])
    expect(background().zIndex()).toBe(0)
  })

  /** Whether the mark is one unit inside the background on every side. */
  const expectMarkInsideBackground = (): void => {
    const mark = marks()[0]
    expect(mark.x()).toBe(background().x() + 1)
    expect(mark.y()).toBe(background().y() + 1)
    expect(mark.width()).toBe(background().width() - 2)
    expect(mark.height()).toBe(background().height() - 2)
  }
  /** Drag a handle of the bin, as the transformer does: it scales the node, then lets go. */
  const dragHandle = (scaleX: number, shiftX: number): void => {
    const node = binNode()
    node.fire('transformstart')
    node.scaleX(scaleX)
    node.x(node.x() + shiftX)
    node.fire('transform')
    node.fire('transformend')
  }

  it('follows a bin made wider by its handle', () => {
    engine.setGroupWarnings(['bin'])
    dragHandle(2, 42)
    expect(engine.getGroup('bin')!.width).toBe(168)
    expectMarkInsideBackground()
  })

  it('follows a bin made narrower by its handle, and leaves its bounds no bigger', () => {
    engine.updateGroup('bin', { width: 168 })
    engine.setGroupWarnings(['bin'])
    dragHandle(0.5, -42)
    expect(engine.getGroup('bin')!.width).toBe(84)
    expectMarkInsideBackground()
    expect(binNode().getClientRect({ skipTransform: true }).width).toBeLessThan(90)
  })

  it('follows the bin when it is resized', () => {
    engine.setGroupWarnings(['bin'])
    engine.updateGroup('bin', { width: 168, height: 42 })
    const mark = marks()[0]
    expect(mark.width()).toBe(background().width() - 2)
    expect(mark.height()).toBe(background().height() - 2)
    expect(mark.x()).toBe(background().x() + 1)
    expect(mark.y()).toBe(background().y() + 1)
  })
})
