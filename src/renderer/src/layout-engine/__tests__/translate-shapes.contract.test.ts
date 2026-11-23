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

function makeContainer(): HTMLDivElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(div, 'clientHeight', { value: 600, configurable: true })
  document.body.appendChild(div)
  return div
}

const base = {
  rotation: 0,
  fill: '#cccccc',
  stroke: '#000000',
  strokeWidth: 1,
  groupId: null
}

function rect(id: string, x: number, y: number, width = 20, height = 10): LayoutShape {
  return { ...base, id, type: 'rect', x, y, width, height }
}

function bin(id: string, x: number): LayoutGroup {
  return {
    id,
    x,
    y: 100,
    width: 100,
    height: 100,
    rotation: 0,
    childIds: [],
    style: { fill: 'transparent', stroke: '#666', strokeWidth: 1 },
    metadata: { widthUnits: 1, depthUnits: 1, heightUnits: 3, hasLip: true }
  }
}

describe('shape bounds and translateShapes', () => {
  let engine: LayoutEngine
  let container: HTMLDivElement

  beforeEach(() => {
    container = makeContainer()
    engine = createLayoutEngine()
    engine.mount(container)
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  const bounds = (id: string): number[] => {
    const b = engine.getShapeBounds(id)!
    return [b.minX, b.minY, b.maxX, b.maxY].map((n) => Math.round(n * 100) / 100)
  }

  it('reports world bounds for rects, circles and polygons', () => {
    engine.addShape(rect('r', 40, 60))
    engine.addShape({ ...base, id: 'c', type: 'circle', x: 10, y: 10, radiusX: 5, radiusY: 8 })
    engine.addShape({
      ...base,
      id: 'p',
      type: 'polygon',
      x: 100,
      y: 100,
      points: [
        { x: -20, y: -10 },
        { x: 20, y: -5 },
        { x: -10, y: 10 }
      ]
    })
    expect(bounds('r')).toEqual([30, 55, 50, 65])
    expect(bounds('c')).toEqual([5, 2, 15, 18])
    expect(bounds('p')).toEqual([80, 90, 120, 110])
    expect(engine.getShapeBounds('missing')).toBeUndefined()
  })

  it('reports the same world bounds for a shape inside a bin, whatever the view', () => {
    engine.createGroup(bin('bin', 0))
    engine.addShape(rect('r', 40, 60))
    engine.addToGroup('r', 'bin')
    expect(bounds('r')).toEqual([30, 55, 50, 65])

    engine.zoomTo(2.5)
    engine.panTo(123, -45)
    expect(bounds('r')).toEqual([30, 55, 50, 65])
  })

  it('includes rotation in the bounds', () => {
    engine.addShape({ ...rect('r', 40, 60), rotation: 90 })
    expect(bounds('r')).toEqual([35, 50, 45, 70])
  })

  it('moves shapes by world offsets, in or out of a bin', () => {
    engine.createGroup(bin('bin', 0))
    engine.addShape(rect('in', 40, 60))
    engine.addToGroup('in', 'bin')
    engine.addShape(rect('out', 300, 60))

    engine.translateShapes([
      { id: 'in', dx: 10, dy: -20 },
      { id: 'out', dx: -5, dy: 5 }
    ])

    expect(bounds('in')).toEqual([40, 35, 60, 45])
    expect(bounds('out')).toEqual([285, 60, 305, 70])
    expect(engine.getShape('in')!.groupId).toBe('bin')
  })

  it('reassigns a shape whose center lands in another bin or in none', () => {
    engine.createGroup(bin('a', 0))
    engine.createGroup(bin('b', 200))
    engine.addShape(rect('r', 40, 60))
    engine.addToGroup('r', 'a')

    engine.translateShapes([{ id: 'r', dx: 200, dy: 0 }])
    expect(engine.getShape('r')!.groupId).toBe('b')
    expect(engine.getGroup('a')!.childIds).toEqual([])
    expect(engine.getGroup('b')!.childIds).toEqual(['r'])
    expect(bounds('r')).toEqual([230, 55, 250, 65])

    engine.translateShapes([{ id: 'r', dx: -100, dy: 0 }])
    expect(engine.getShape('r')!.groupId).toBeNull()
    expect(bounds('r')).toEqual([130, 55, 150, 65])
  })

  it('delivers its events together, after every shape has moved', () => {
    engine.createGroup(bin('a', 0))
    engine.createGroup(bin('b', 200))
    engine.addShape(rect('r1', 40, 60))
    engine.addShape(rect('r2', 60, 20))
    engine.addToGroup('r1', 'a')
    engine.addToGroup('r2', 'a')

    const seen: string[] = []
    const snapshotAtEvent: string[] = []
    const record = (name: string) => () => {
      seen.push(name)
      snapshotAtEvent.push(JSON.stringify(engine.toSnapshot()))
    }
    engine.on('shapeMoved', record('shapeMoved'))
    engine.on('groupChanged', record('groupChanged'))

    engine.translateShapes([
      { id: 'r1', dx: 200, dy: 0 },
      { id: 'r2', dx: 5, dy: 0 },
      { id: 'missing', dx: 1, dy: 1 },
      { id: 'r2', dx: 0, dy: 0 }
    ])

    expect(seen.filter((e) => e === 'shapeMoved')).toHaveLength(2)
    expect(seen).toContain('groupChanged')
    // Every listener saw the same, final state: one undo step.
    expect(new Set(snapshotAtEvent).size).toBe(1)
    expect(snapshotAtEvent[0]).toBe(JSON.stringify(engine.toSnapshot()))
  })

  it('moves and reassigns the same way when the view is zoomed and panned', () => {
    engine.createGroup(bin('a', 0))
    engine.createGroup(bin('b', 200))
    engine.addShape(rect('r', 40, 60))
    engine.addToGroup('r', 'a')
    engine.zoomTo(2.5)
    engine.panTo(123, -45)

    engine.translateShapes([{ id: 'r', dx: 200, dy: 10 }])
    expect(engine.getShape('r')!.groupId).toBe('b')
    expect(bounds('r')).toEqual([230, 65, 250, 75])

    engine.translateShapes([{ id: 'r', dx: -100, dy: 0 }])
    expect(engine.getShape('r')!.groupId).toBeNull()
    expect(bounds('r')).toEqual([130, 65, 150, 75])
    expect(engine.getShape('r')!.x).toBeCloseTo(140)
    expect(engine.getShape('r')!.y).toBeCloseTo(70)
  })

  it('moves rotated shapes and polygons by the same world offset', () => {
    engine.addShape({ ...rect('r', 40, 60), rotation: 90 })
    engine.addShape({
      ...base,
      id: 'p',
      type: 'polygon',
      x: 100,
      y: 100,
      points: [
        { x: -20, y: -10 },
        { x: 20, y: -5 },
        { x: -10, y: 10 }
      ]
    })
    engine.translateShapes([
      { id: 'r', dx: 7, dy: -3 },
      { id: 'p', dx: -10, dy: 20 }
    ])
    expect(bounds('r')).toEqual([42, 47, 52, 67])
    expect(bounds('p')).toEqual([70, 110, 110, 130])
  })

  it('assigns by the center of the shape as drawn, not the path origin', () => {
    engine.createGroup(bin('bin', 0))
    // The path's origin (150, 50) is outside the bin; what it draws,
    // x 50..70, is inside.
    engine.addShape({
      ...base,
      id: 'path',
      type: 'svgPath',
      x: 150,
      y: 50,
      pathData: 'M -100 -10 L -80 -10 L -80 10 L -100 10 Z'
    })
    expect(engine.getShape('path')!.groupId).toBeNull()

    engine.translateShapes([{ id: 'path', dx: 0, dy: 5 }])
    expect(engine.getShape('path')!.groupId).toBe('bin')
  })

  it('applies every move for an id that is listed more than once, and reports it once', () => {
    engine.addShape(rect('r', 40, 60))
    const moved: string[] = []
    engine.on('shapeMoved', (e) => moved.push(e.id))
    engine.translateShapes([
      { id: 'r', dx: 5, dy: 0 },
      { id: 'r', dx: 5, dy: 2 }
    ])
    expect(bounds('r')).toEqual([40, 57, 60, 67])
    expect(moved).toEqual(['r'])
  })

  it('does nothing for an empty list', () => {
    const seen: string[] = []
    engine.on('shapeMoved', () => seen.push('moved'))
    engine.translateShapes([])
    expect(seen).toEqual([])
  })
})
