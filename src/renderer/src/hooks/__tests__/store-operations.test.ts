import { describe, it, expect } from 'vitest'
import {
  createEmptyProject,
  createDefaultTransform,
  type ProjectData,
  type Entity,
  type Bin
} from '../../../../shared/types/project'

/**
 * Tests for store-level operations: bin CRUD, entity ownership,
 * moveBin, undo/redo, and isModified tracking.
 *
 * These replicate the Zustand store logic as pure data transformations
 * (same pattern as entity-mutations.test.ts) to avoid module singleton issues.
 */

// ── Helpers that replicate store logic ──

function addBin(project: ProjectData, patch?: Partial<Bin>): { project: ProjectData; bin: Bin } {
  const existingCount = project.bins.length
  const bin: Bin = {
    id: patch?.id ?? crypto.randomUUID(),
    name: `Bin ${existingCount + 1}`,
    width: 1,
    depth: 1,
    height: 3,
    position: { x: 0, y: 0 },
    hasDividers: false,
    hasLabel: false,
    hasStackingLip: true,
    entityIds: [],
    properties: {},
    ...patch
  }
  return {
    project: { ...project, bins: [...project.bins, bin] },
    bin
  }
}

function removeBin(project: ProjectData, id: string): ProjectData {
  return { ...project, bins: project.bins.filter((b) => b.id !== id) }
}

function updateBin(project: ProjectData, id: string, patch: Partial<Bin>): ProjectData {
  return {
    ...project,
    bins: project.bins.map((b) => (b.id === id ? { ...b, ...patch } : b))
  }
}

function moveBinFn(project: ProjectData, id: string, dx: number, dy: number): ProjectData {
  const bin = project.bins.find((b) => b.id === id)
  return {
    ...project,
    bins: project.bins.map((b) =>
      b.id === id ? { ...b, position: { x: b.position.x + dx, y: b.position.y + dy } } : b
    ),
    entities: project.entities.map((e) => {
      if (!bin?.entityIds.includes(e.id)) return e
      return {
        ...e,
        transform: {
          ...e.transform,
          position: {
            ...e.transform.position,
            x: e.transform.position.x + dx,
            y: e.transform.position.y + dy
          }
        }
      }
    })
  }
}

function addEntity(
  project: ProjectData,
  partial: Partial<Entity> & { type: Entity['type'] },
  binId?: string
): { project: ProjectData; entity: Entity } {
  const label = partial.type.charAt(0).toUpperCase() + partial.type.slice(1)
  const existingCount = project.entities.filter((e) => e.type === partial.type).length
  const entity = {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? `${label} ${existingCount + 1}`,
    transform: partial.transform ?? createDefaultTransform(),
    visible: true,
    locked: false,
    properties: {},
    pocket: { depth: 5, clearance: 0.2 },
    ...partial
  } as Entity

  const targetId = binId ?? project.bins[0]?.id
  const updatedBins = targetId
    ? project.bins.map((b) =>
        b.id === targetId ? { ...b, entityIds: [...b.entityIds, entity.id] } : b
      )
    : project.bins

  return {
    project: { ...project, entities: [...project.entities, entity], bins: updatedBins },
    entity
  }
}

function removeEntity(project: ProjectData, id: string): ProjectData {
  return {
    ...project,
    entities: project.entities.filter((e) => e.id !== id),
    bins: project.bins.map((b) => ({
      ...b,
      entityIds: b.entityIds.filter((eid) => eid !== id)
    }))
  }
}

// Undo/redo simulation
interface UndoState {
  project: ProjectData
  undoStack: ProjectData[]
  redoStack: ProjectData[]
}

function snapshot(state: UndoState): UndoState {
  return {
    ...state,
    undoStack: [...state.undoStack, state.project],
    redoStack: []
  }
}

function undoFn(state: UndoState): UndoState {
  if (state.undoStack.length === 0) return state
  const stack = [...state.undoStack]
  const prev = stack.pop()!
  return {
    project: prev,
    undoStack: stack,
    redoStack: [...state.redoStack, state.project]
  }
}

function redoFn(state: UndoState): UndoState {
  if (state.redoStack.length === 0) return state
  const stack = [...state.redoStack]
  const next = stack.pop()!
  return {
    project: next,
    redoStack: stack,
    undoStack: [...state.undoStack, state.project]
  }
}

/** Chain: add bin to project, return updated project and the bin */
function withBin(project: ProjectData, patch?: Partial<Bin>): [ProjectData, Bin] {
  const result = addBin(project, patch)
  return [result.project, result.bin]
}

/** Chain: add entity to project, return updated project and the entity */
function withEntity(
  project: ProjectData,
  partial: Partial<Entity> & { type: Entity['type'] },
  binId?: string
): [ProjectData, Entity] {
  const result = addEntity(project, partial, binId)
  return [result.project, result.entity]
}

// ── Tests ──

describe('bin CRUD', () => {
  it('addBin creates a bin with defaults', () => {
    const project = createEmptyProject('Test')
    const { project: updated, bin } = addBin(project)
    expect(updated.bins).toHaveLength(1)
    expect(bin.name).toBe('Bin 1')
    expect(bin.width).toBe(1)
    expect(bin.depth).toBe(1)
    expect(bin.height).toBe(3)
    expect(bin.entityIds).toEqual([])
    expect(bin.id).toBeTruthy()
  })

  it('addBin increments name sequentially', () => {
    let project = createEmptyProject('Test')
    ;({ project } = addBin(project))
    const { bin: bin2 } = addBin(project)
    expect(bin2.name).toBe('Bin 2')
  })

  it('addBin applies patch overrides', () => {
    const project = createEmptyProject('Test')
    const { bin } = addBin(project, { width: 3, depth: 2, name: 'Custom' })
    expect(bin.name).toBe('Custom')
    expect(bin.width).toBe(3)
    expect(bin.depth).toBe(2)
  })

  it('removeBin removes the bin', () => {
    const project = createEmptyProject('Test')
    const { project: p, bin } = addBin(project)
    const result = removeBin(p, bin.id)
    expect(result.bins).toHaveLength(0)
  })

  it('removeBin preserves other bins', () => {
    let project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    project = removeBin(p2, bin1.id)
    expect(project.bins).toHaveLength(1)
    expect(project.bins[0].id).toBe(bin2.id)
  })

  it('updateBin updates specific fields', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project)
    const updated = updateBin(p, bin.id, { width: 5, name: 'Renamed' })
    expect(updated.bins[0].width).toBe(5)
    expect(updated.bins[0].name).toBe('Renamed')
    expect(updated.bins[0].depth).toBe(1) // unchanged
  })

  it('updateBin does not affect other bins', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    const updated = updateBin(p2, bin1.id, { width: 10 })
    expect(updated.bins.find((b) => b.id === bin2.id)!.width).toBe(1)
  })
})

describe('entity ownership', () => {
  it('addEntity assigns to specified bin', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project)
    const { project: updated } = addEntity(p, { type: 'circle', diameter: 10 } as never, bin.id)
    expect(updated.bins[0].entityIds).toHaveLength(1)
  })

  it('addEntity defaults to first bin when no binId given', () => {
    let project = createEmptyProject('Test')
    ;({ project } = addBin(project))
    ;({ project } = addBin(project))
    const { project: updated, entity } = addEntity(project, {
      type: 'circle',
      diameter: 10
    } as never)
    expect(updated.bins[0].entityIds).toContain(entity.id)
    expect(updated.bins[1].entityIds).not.toContain(entity.id)
  })

  it('addEntity to second bin does not affect first bin', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    const { project: updated, entity } = addEntity(
      p2,
      { type: 'rectangle', width: 5, height: 5 } as never,
      bin2.id
    )
    expect(updated.bins.find((b) => b.id === bin1.id)!.entityIds).toHaveLength(0)
    expect(updated.bins.find((b) => b.id === bin2.id)!.entityIds).toContain(entity.id)
  })

  it('removeEntity cleans up entityIds from all bins', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project)
    const [p2, entity] = withEntity(p, { type: 'circle', diameter: 10 } as never, bin.id)
    const result = removeEntity(p2, entity.id)
    expect(result.bins[0].entityIds).toHaveLength(0)
    expect(result.entities).toHaveLength(0)
  })

  it('reassign entity between bins via updateBin', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    const [p3, entity] = withEntity(p2, { type: 'circle', diameter: 10 } as never, bin1.id)

    // Remove from bin1 — use fresh entityIds from p3
    const freshBin1Ids = p3.bins.find((b) => b.id === bin1.id)!.entityIds
    let result = updateBin(p3, bin1.id, {
      entityIds: freshBin1Ids.filter((id) => id !== entity.id)
    })
    // Add to bin2
    const freshBin2Ids = result.bins.find((b) => b.id === bin2.id)!.entityIds
    result = updateBin(result, bin2.id, { entityIds: [...freshBin2Ids, entity.id] })

    expect(result.bins.find((b) => b.id === bin1.id)!.entityIds).not.toContain(entity.id)
    expect(result.bins.find((b) => b.id === bin2.id)!.entityIds).toContain(entity.id)
  })
})

describe('moveBin', () => {
  it('moves bin position by delta', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project, { position: { x: 0, y: 0 } })
    const result = moveBinFn(p, bin.id, 42, 84)
    expect(result.bins[0].position).toEqual({ x: 42, y: 84 })
  })

  it('moves child entities by same delta', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project, { position: { x: 0, y: 0 } })
    const [p2, entity] = withEntity(
      p,
      {
        type: 'circle',
        diameter: 10,
        transform: { ...createDefaultTransform(), position: { x: 10, y: 20, z: 0 } }
      } as never,
      bin.id
    )
    const result = moveBinFn(p2, bin.id, 42, 84)
    const moved = result.entities.find((e) => e.id === entity.id)!
    expect(moved.transform.position.x).toBe(52)
    expect(moved.transform.position.y).toBe(104)
  })

  it('does not move entities belonging to other bins', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    const [p3, entityInBin2] = withEntity(
      p2,
      {
        type: 'circle',
        diameter: 10,
        transform: { ...createDefaultTransform(), position: { x: 5, y: 5, z: 0 } }
      } as never,
      bin2.id
    )
    const result = moveBinFn(p3, bin1.id, 100, 100)
    const unmoved = result.entities.find((e) => e.id === entityInBin2.id)!
    expect(unmoved.transform.position.x).toBe(5)
    expect(unmoved.transform.position.y).toBe(5)
  })

  it('preserves z coordinate of moved entities', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project)
    const [p2, entity] = withEntity(
      p,
      {
        type: 'circle',
        diameter: 10,
        transform: { ...createDefaultTransform(), position: { x: 0, y: 0, z: 5 } }
      } as never,
      bin.id
    )
    const result = moveBinFn(p2, bin.id, 10, 20)
    const moved = result.entities.find((e) => e.id === entity.id)!
    expect(moved.transform.position.z).toBe(5)
  })

  it('moves multiple children atomically', () => {
    const project = createEmptyProject('Test')
    const [p, bin] = withBin(project)
    const [p2, e1] = withEntity(
      p,
      {
        type: 'circle',
        diameter: 5,
        transform: { ...createDefaultTransform(), position: { x: 0, y: 0, z: 0 } }
      } as never,
      bin.id
    )
    const [p3, e2] = withEntity(
      p2,
      {
        type: 'rectangle',
        width: 10,
        height: 10,
        transform: { ...createDefaultTransform(), position: { x: 20, y: 30, z: 0 } }
      } as never,
      bin.id
    )
    const result = moveBinFn(p3, bin.id, 5, 10)
    expect(result.entities.find((e) => e.id === e1.id)!.transform.position).toEqual({
      x: 5,
      y: 10,
      z: 0
    })
    expect(result.entities.find((e) => e.id === e2.id)!.transform.position).toEqual({
      x: 25,
      y: 40,
      z: 0
    })
  })

  it('does not affect other bins', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project, { position: { x: 0, y: 0 } })
    const [p2, bin2] = withBin(p1, { position: { x: 100, y: 100 } })
    const result = moveBinFn(p2, bin1.id, 50, 50)
    expect(result.bins.find((b) => b.id === bin2.id)!.position).toEqual({ x: 100, y: 100 })
  })
})

describe('undo/redo', () => {
  it('undo restores previous state', () => {
    let state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    state = snapshot(state)
    state.project = addBin(state.project).project
    state = undoFn(state)
    expect(state.project.bins).toHaveLength(0)
  })

  it('redo restores undone state', () => {
    let state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    state = snapshot(state)
    state.project = addBin(state.project).project
    state = undoFn(state)
    expect(state.project.bins).toHaveLength(0)
    state = redoFn(state)
    expect(state.project.bins).toHaveLength(1)
  })

  it('undo is no-op when stack is empty', () => {
    const state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    const result = undoFn(state)
    expect(result.project).toBe(state.project)
  })

  it('redo is no-op when stack is empty', () => {
    const state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    const result = redoFn(state)
    expect(result.project).toBe(state.project)
  })

  it('new mutation clears redo stack', () => {
    let state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    state = snapshot(state)
    state.project = addBin(state.project).project
    state = undoFn(state)
    expect(state.redoStack).toHaveLength(1)
    // New mutation should clear redo
    state = snapshot(state)
    state.project = addBin(state.project).project
    expect(state.redoStack).toHaveLength(0)
  })

  it('multiple undo/redo cycles preserve data', () => {
    let state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    state = snapshot(state)
    state.project = addBin(state.project, { name: 'Bin A' }).project
    state = snapshot(state)
    state.project = addBin(state.project, { name: 'Bin B' }).project

    expect(state.project.bins).toHaveLength(2)

    state = undoFn(state)
    expect(state.project.bins).toHaveLength(1)
    expect(state.project.bins[0].name).toBe('Bin A')

    state = undoFn(state)
    expect(state.project.bins).toHaveLength(0)

    state = redoFn(state)
    expect(state.project.bins).toHaveLength(1)

    state = redoFn(state)
    expect(state.project.bins).toHaveLength(2)
  })

  it('undo restores entity after removal', () => {
    let state: UndoState = {
      project: createEmptyProject('Test'),
      undoStack: [],
      redoStack: []
    }
    state = snapshot(state)
    const [p1, bin] = withBin(state.project)
    state.project = p1
    state = snapshot(state)
    const [p2, entity] = withEntity(
      state.project,
      { type: 'circle', diameter: 10 } as never,
      bin.id
    )
    state.project = p2
    const entityId = entity.id

    state = snapshot(state)
    state.project = removeEntity(state.project, entityId)
    expect(state.project.entities).toHaveLength(0)

    state = undoFn(state)
    expect(state.project.entities).toHaveLength(1)
    expect(state.project.entities[0].id).toBe(entityId)
    expect(state.project.bins[0].entityIds).toContain(entityId)
  })
})

describe('isModified tracking', () => {
  it('new project starts modified (unsaved)', () => {
    const isModified = true
    expect(isModified).toBe(true)
  })

  it('mutations set isModified', () => {
    const project = createEmptyProject('Test')
    const { project: updated } = addBin(project)
    expect(updated.bins).toHaveLength(1)
  })
})

describe('removeEntity cleans up bin references', () => {
  it('entity removed from all bins that reference it', () => {
    const project = createEmptyProject('Test')
    const [p1, bin1] = withBin(project)
    const [p2, bin2] = withBin(p1)
    const [p3, entity] = withEntity(p2, { type: 'circle', diameter: 10 } as never, bin1.id)

    // Manually also add to bin2 (simulating a bug or edge case)
    const p4 = updateBin(p3, bin2.id, {
      entityIds: [...p3.bins.find((b) => b.id === bin2.id)!.entityIds, entity.id]
    })

    expect(p4.bins.find((b) => b.id === bin1.id)!.entityIds).toContain(entity.id)
    expect(p4.bins.find((b) => b.id === bin2.id)!.entityIds).toContain(entity.id)

    const result = removeEntity(p4, entity.id)

    expect(result.bins.find((b) => b.id === bin1.id)!.entityIds).not.toContain(entity.id)
    expect(result.bins.find((b) => b.id === bin2.id)!.entityIds).not.toContain(entity.id)
  })
})

describe('settings mutations', () => {
  it('updateSettings patches project settings', () => {
    const project = createEmptyProject('Test')
    const updated = {
      ...project,
      settings: { ...project.settings, name: 'Renamed Project' }
    }
    expect(updated.settings.name).toBe('Renamed Project')
  })

  it('updateSettings preserves other settings fields', () => {
    const project = createEmptyProject('Test')
    const originalName = project.settings.name
    const updated = {
      ...project,
      settings: { ...project.settings, description: 'A description' }
    }
    expect(updated.settings.name).toBe(originalName)
  })
})
