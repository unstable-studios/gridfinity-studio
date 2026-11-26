/**
 * @vitest-environment jsdom
 *
 * Contract tests for group warnings: a mark the engine shows on a group for the person to
 * see. It is display only, so it must change nothing that is saved or undone.
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
import type { LayoutEngine } from '../interface'
import type { EngineEventMap, LayoutGroup } from '../types'
import { createLayoutEngine } from '../create-engine'

function makeBin(id: string, x: number): LayoutGroup {
  return {
    id,
    x,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: { fill: 'rgba(96, 165, 250, 0.10)', stroke: '#60a5fa', strokeWidth: 1, cornerRadius: 4 },
    metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true, name: id }
  }
}

const EVENTS: (keyof EngineEventMap)[] = [
  'groupChanged',
  'groupMoved',
  'groupResized',
  'selectionChanged'
]

describe('Group warnings contract', () => {
  let engine: LayoutEngine
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = createLayoutEngine()
    engine.mount(container)
    engine.createGroup(makeBin('a', 0))
    engine.createGroup(makeBin('b', 126))
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  it('W1: no group carries a warning until one is set', () => {
    expect(engine.getGroupWarnings()).toEqual([])
  })

  it('W2: the groups named carry a warning, and no others', () => {
    engine.setGroupWarnings(['b'])
    expect(engine.getGroupWarnings()).toEqual(['b'])

    engine.setGroupWarnings(['a'])
    expect(engine.getGroupWarnings()).toEqual(['a'])

    engine.setGroupWarnings(['a', 'b'])
    expect(engine.getGroupWarnings().sort()).toEqual(['a', 'b'])

    engine.setGroupWarnings([])
    expect(engine.getGroupWarnings()).toEqual([])
  })

  it('W3: a warning changes nothing in the snapshot', () => {
    const before = JSON.stringify(engine.toSnapshot())
    engine.setGroupWarnings(['a', 'b'])
    expect(JSON.stringify(engine.toSnapshot())).toBe(before)
    engine.setGroupWarnings([])
    expect(JSON.stringify(engine.toSnapshot())).toBe(before)
  })

  it('W4: a warning leaves the group where it is, the size it is', () => {
    const before = engine.getGroup('a')
    engine.setGroupWarnings(['a'])
    expect(engine.getGroup('a')).toEqual(before)
  })

  it('W5: setting warnings raises no event', () => {
    const heard = vi.fn()
    const stop = EVENTS.map((event) => engine.on(event, heard))
    engine.setGroupWarnings(['a'])
    engine.setGroupWarnings(['a'])
    engine.setGroupWarnings([])
    stop.forEach((off) => off())
    expect(heard).not.toHaveBeenCalled()
  })

  it('W6: a warning follows a group that is removed and comes back', () => {
    engine.setGroupWarnings(['a'])
    engine.removeGroup('a')
    expect(engine.getGroupWarnings()).toEqual([])

    engine.createGroup(makeBin('a', 0))
    expect(engine.getGroupWarnings()).toEqual(['a'])
  })

  it('W7: a warning set for a group that does not exist yet applies when it is created', () => {
    engine.setGroupWarnings(['c'])
    expect(engine.getGroupWarnings()).toEqual([])

    engine.createGroup(makeBin('c', 252))
    expect(engine.getGroupWarnings()).toEqual(['c'])
  })

  it('W8: warnings stay on the groups a loaded snapshot brings back', () => {
    engine.setGroupWarnings(['b'])
    engine.loadSnapshot(engine.toSnapshot())
    expect(engine.getGroupWarnings()).toEqual(['b'])
  })

  it('W9: a warned group can still be moved and resized', () => {
    engine.setGroupWarnings(['a'])
    expect(engine.updateGroup('a', { width: 42, height: 42 })).toBe(true)
    expect(engine.getGroup('a')).toMatchObject({ width: 42, height: 42 })
    expect(engine.getGroupWarnings()).toEqual(['a'])
  })
})
