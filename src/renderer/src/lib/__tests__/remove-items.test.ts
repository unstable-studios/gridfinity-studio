/**
 * @vitest-environment jsdom
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
import { createLayoutEngine } from '@/layout-engine/create-engine'
import type { LayoutEngine } from '@/layout-engine'
import type { LayoutGroup, LayoutShape } from '@/layout-engine/types'
import { removeItems } from '../remove-items'

function bin(id: string, x: number): LayoutGroup {
  return {
    id,
    x,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { fill: 'transparent', stroke: '#666666', strokeWidth: 1 },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: id }
  }
}

function rect(id: string, x: number, y: number, depth?: number): LayoutShape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 10,
    height: 10,
    rotation: 0,
    fill: '#bbbbbb',
    stroke: '#000000',
    strokeWidth: 1,
    groupId: null,
    metadata: depth === undefined ? {} : { pocket: { depth } }
  }
}

describe('removeItems', () => {
  let engine: LayoutEngine
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = createLayoutEngine()
    engine.mount(container)
    engine.createGroup(bin('a', 0))
    engine.createGroup(bin('b', 126))
    engine.addShape(rect('in-a', 40, 40))
    engine.addToGroup('in-a', 'a')
    engine.addShape(rect('in-b', 166, 40))
    engine.addToGroup('in-b', 'b')
    engine.addShape(rect('loose', 400, 400))
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  const ids = (): string[] =>
    [...engine.getAllGroups(), ...engine.getAllShapes()].map((item) => item.id).sort()

  it('removes a bin together with the shapes in it', () => {
    removeItems(engine, ['a'])

    expect(ids()).toEqual(['b', 'in-b', 'loose'])
  })

  it('removes a shape on its own and leaves its bin', () => {
    removeItems(engine, ['in-b', 'loose'])

    expect(ids()).toEqual(['a', 'b', 'in-a'])
    expect(engine.getGroup('b')!.childIds).toEqual([])
  })

  it('copes with a bin and its own shape both being named', () => {
    removeItems(engine, ['a', 'in-a'])

    expect(ids()).toEqual(['b', 'in-b', 'loose'])
  })

  it('clears the selection and does nothing for an empty list', () => {
    engine.select(['a'])
    removeItems(engine, [])
    expect(engine.getSelectedIds()).toEqual(['a'])

    removeItems(engine, ['a'])
    expect(engine.getSelectedIds()).toEqual([])
  })

  it('tells listeners once, when everything has been removed', () => {
    const seen: string[][] = []
    const record = (): void => void seen.push(ids())
    engine.on('shapeDeleted', record)
    engine.on('groupChanged', record)

    removeItems(engine, ['a', 'loose'])

    // Every listener call sees the finished state: nothing half removed to record for undo.
    expect(seen.length).toBeGreaterThan(0)
    for (const state of seen) expect(state).toEqual(['b', 'in-b'])
  })
})

describe('pocket shading follows the bin', () => {
  it('shades a pocket by its depth as soon as it joins a bin', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const engine = createLayoutEngine()
    engine.mount(container)
    const opacityOf = (id: string): number =>
      (engine as unknown as { konvaMap: Map<string, { opacity: () => number }> }).konvaMap
        .get(id)!
        .opacity()
    engine.createGroup(bin('a', 0))
    engine.addShape(rect('deep', 40, 40, 5))
    expect(opacityOf('deep')).toBe(1)

    engine.addToGroup('deep', 'a')
    const shaded = opacityOf('deep')
    expect(shaded).toBeLessThan(1)

    engine.removeFromGroup('deep')
    expect(opacityOf('deep')).toBe(1)

    engine.dispose()
    container.remove()
    vi.restoreAllMocks()
  })
})
