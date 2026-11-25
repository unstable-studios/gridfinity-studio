/**
 * @vitest-environment jsdom
 *
 * Resizing a bin through the real canvas engine: what moves, what is said, and that it is
 * one change.
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

const notices = vi.hoisted(() => ({ moved: [] as string[], blocked: [] as string[] }))
vi.mock('../project-notices', () => ({
  notifyBinMoved: (bin: string) => notices.moved.push(bin),
  notifyResizeBlocked: (blocker: string) => notices.blocked.push(blocker)
}))

import { KonvaEngine } from '@/layout-engine/konva-engine'
import type { BinMetadata, LayoutShape } from '@/layout-engine/types'
import { addBin } from '../new-bin'
import { updateBin } from '../bin-update'
import { DEFAULT_NEW_BIN } from '../../../../shared/types/project'

const U = 42

describe('updateBin', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement
  let changes: number

  const bin = (id: string): { x: number; y: number; width: number; height: number } => {
    const { x, y, width, height } = engine.getGroup(id)!
    return { x, y, width, height }
  }
  /** A bin whose lower-left grid square is at column, row. */
  const add = (column: number, row: number, wide = 1, deep = 1): string =>
    addBin(
      engine,
      { x: column * U, y: (row + 1) * U, widthUnits: wide, depthUnits: deep },
      U,
      DEFAULT_NEW_BIN
    )

  beforeEach(() => {
    notices.moved.length = 0
    notices.blocked.length = 0
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = new KonvaEngine()
    engine.mount(container)
    changes = 0
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  const countChanges = (): void => {
    engine.on('groupChanged', () => changes++)
    engine.on('groupMoved', () => changes++)
    engine.on('groupResized', () => changes++)
  }

  it('grows a bin in place when there is room, and says nothing', () => {
    const a = add(0, 0)
    countChanges()
    updateBin(engine, a, { widthUnits: 3, depthUnits: 2 }, U)

    // The lower-left corner stays put: it grows right and up.
    expect(bin(a)).toEqual({ x: 0, y: U, width: 3 * U, height: 2 * U })
    expect(engine.getGroup(a)!.metadata).toMatchObject({ widthUnits: 3, depthUnits: 2 })
    expect(notices).toEqual({ moved: [], blocked: [] })
    expect(changes).toBe(1)
  })

  it('moves the bin to make room, with its pockets, as one change', () => {
    const a = add(0, 0)
    add(2, 0)
    const pocket: LayoutShape = {
      id: 'pocket',
      type: 'rect',
      x: 21,
      y: 21,
      width: 10,
      height: 8,
      rotation: 0,
      fill: '#bbb',
      stroke: '#000',
      strokeWidth: 1,
      groupId: null
    }
    engine.addShape(pocket)
    engine.addToGroup('pocket', a)
    const before = engine.getShapeBounds('pocket')!
    countChanges()

    // Three wide would cover the second bin, so it goes one square left.
    updateBin(engine, a, { widthUnits: 3 }, U)

    expect(bin(a)).toEqual({ x: -U, y: U, width: 3 * U, height: U })
    expect(notices.moved).toEqual(['Bin 1'])
    expect(notices.blocked).toEqual([])
    expect(changes, 'one change, so one undo step').toBe(1)
    // The pocket is where it was in the bin: one square further left on the canvas.
    const after = engine.getShapeBounds('pocket')!
    expect(after.minX).toBeCloseTo(before.minX - U, 5)
    expect(after.minY).toBeCloseTo(before.minY, 5)
    expect(engine.getShape('pocket')!.groupId).toBe(a)
  })

  it('changes nothing and names the bin in the way when nowhere nearby is free', () => {
    const a = add(0, 0)
    for (let column = -4; column <= 5; column++) {
      for (let row = -3; row <= 3; row++) {
        if (column !== 0 || row !== 0) add(column, row)
      }
    }
    const rightNeighbor = engine
      .getAllGroups()
      .find((group) => group.x === U && group.y === U && group.id !== a)!
    countChanges()

    updateBin(engine, a, { widthUnits: 2 }, U)

    expect(bin(a)).toEqual({ x: 0, y: U, width: U, height: U })
    expect((engine.getGroup(a)!.metadata as BinMetadata).widthUnits).toBe(1)
    expect(notices.blocked).toEqual([(rightNeighbor.metadata as BinMetadata).name])
    expect(notices.moved).toEqual([])
    expect(changes).toBe(0)
  })

  it('changes height and lip without looking for room', () => {
    const a = add(0, 0)
    add(1, 0)
    updateBin(engine, a, { heightUnits: 6, hasLip: false }, U)

    expect(engine.getGroup(a)!.metadata).toMatchObject({ heightUnits: 6, hasLip: false })
    expect(bin(a)).toEqual({ x: 0, y: U, width: U, height: U })
    expect(notices).toEqual({ moved: [], blocked: [] })
  })

  it('lets a bin shrink where it is', () => {
    const a = add(0, 0, 3, 2)
    add(3, 0)
    updateBin(engine, a, { widthUnits: 1, depthUnits: 1 }, U)

    expect(bin(a)).toEqual({ x: 0, y: U, width: U, height: U })
    expect(notices).toEqual({ moved: [], blocked: [] })
  })
})
