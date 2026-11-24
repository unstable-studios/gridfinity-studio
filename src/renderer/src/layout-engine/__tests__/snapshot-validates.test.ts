/**
 * @vitest-environment jsdom
 *
 * What the canvas writes must pass the check a project goes through on save and open.
 * Otherwise the app could refuse to save its own work.
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
import { KonvaEngine } from '../konva-engine'
import type { LayoutShape } from '../types'
import { addBin } from '@/lib/new-bin'
import { copySelection, planPaste } from '@/lib/clipboard'
import { createEmptyProject } from '../../../../shared/types/project'
import { repairLayout, validateProject } from '../../../../shared/validation/project-validator'
import type { LayoutSnapshotData } from '../../../../shared/types/project'

const base = { rotation: 0, fill: '#bbb', stroke: '#000', strokeWidth: 1, groupId: null }

describe('a snapshot from the canvas', () => {
  let engine: KonvaEngine
  let container: HTMLDivElement

  /** The snapshot as it reaches the main process: through JSON, as a saved file would be. */
  const saved = (): LayoutSnapshotData => JSON.parse(JSON.stringify(engine.toSnapshot()))
  const check = (): ReturnType<typeof validateProject> =>
    validateProject({ ...createEmptyProject(), layoutSnapshot: saved() })

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    engine = new KonvaEngine()
    engine.mount(container)
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  it('is valid with bins, pockets of each kind, loose shapes and pasted copies', () => {
    const bin = addBin(engine, { x: 0, y: 84, widthUnits: 2, depthUnits: 2 }, 42)
    const shapes = [
      { ...base, id: 'rect', type: 'rect', x: 20, y: 40, width: 10, height: 8 },
      { ...base, id: 'ellipse', type: 'circle', x: 50, y: 40, radiusX: 6, radiusY: 3 },
      {
        ...base,
        id: 'polygon',
        type: 'polygon',
        x: 40,
        y: 60,
        rotation: 30,
        points: [
          { x: -4, y: -4 },
          { x: 4, y: -4 },
          { x: 0, y: 4 }
        ]
      },
      { ...base, id: 'loose', type: 'rect', x: 300, y: 40, width: 10, height: 8 }
    ] as LayoutShape[]
    for (const shape of shapes) engine.addShape(shape)
    for (const id of ['rect', 'ellipse', 'polygon']) engine.addToGroup(id, bin)

    // A copy of the bin and its pockets, pasted as the app does it.
    const copied = copySelection(engine.getAllGroups(), engine.getAllShapes(), [bin])
    const pasted = planPaste(copied!, engine.getAllGroups(), 42, 1, () => crypto.randomUUID())
    engine.batch(() => {
      for (const group of pasted.groups) engine.createGroup(group)
      for (const shape of pasted.shapes) engine.addShape(shape)
      for (const [shapeId, groupId] of pasted.shapeGroup) engine.addToGroup(shapeId, groupId)
    })

    const result = check()
    expect(result.errors).toEqual([])
    // Nothing to put right either: the canvas keeps bins and shapes in step.
    const layout = saved()
    expect(repairLayout(layout)).toBe(layout)
    expect(layout.groups).toHaveLength(2)
    expect(layout.shapes).toHaveLength(7)
  })

  it('is valid after a bin with pockets is removed', () => {
    const bin = addBin(engine, { x: 0, y: 84, widthUnits: 2, depthUnits: 2 }, 42)
    engine.addShape({
      ...base,
      id: 'rect',
      type: 'rect',
      x: 20,
      y: 40,
      width: 10,
      height: 8
    } as LayoutShape)
    engine.addToGroup('rect', bin)
    engine.removeGroup(bin)

    expect(check().errors).toEqual([])
    const layout = saved()
    expect(repairLayout(layout)).toBe(layout)
  })
})
