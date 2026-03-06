import { describe, it, expect } from 'vitest'
import { migrateProject } from '../migrations'

describe('migrateProject', () => {
  it('returns current-version projects unchanged', () => {
    const project = {
      schemaVersion: '0.3.0',
      entities: [],
      bins: []
    }
    const result = migrateProject(project)
    expect(result.warnings).toEqual([])
    expect(result.project.schemaVersion).toBe('0.3.0')
  })

  it('migrates v0.2.0 → v0.3.0: converts extrusion to pocket', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [
        {
          id: 'e1',
          name: 'Circle 1',
          type: 'circle',
          extrusion: { depth: 10, direction: 'down', role: 'cutter' }
        }
      ],
      bins: [{ id: 'b1', name: 'Bin 1' }]
    }
    const result = migrateProject(project)
    expect(result.project.schemaVersion).toBe('0.3.0')

    const entities = result.project.entities as Record<string, unknown>[]
    expect(entities[0].pocket).toEqual({ depth: 10, clearance: 0.2 })
    expect(entities[0].extrusion).toBeUndefined()
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('Migrated project from v0.2.0')
  })

  it('migrates v0.1.0 → v0.3.0', () => {
    const project = {
      schemaVersion: '0.1.0',
      entities: [
        {
          id: 'e1',
          name: 'Rect 1',
          type: 'rectangle',
          extrusion: { depth: 3, direction: 'up', role: 'solid' }
        }
      ],
      bins: []
    }
    const result = migrateProject(project)
    expect(result.project.schemaVersion).toBe('0.3.0')

    const entities = result.project.entities as Record<string, unknown>[]
    expect(entities[0].pocket).toEqual({ depth: 3, clearance: 0.2 })
  })

  it('defaults entityIds to [] for bins without it', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [],
      bins: [{ id: 'b1', name: 'Bin 1' }]
    }
    const result = migrateProject(project)
    const bins = result.project.bins as Record<string, unknown>[]
    expect(bins[0].entityIds).toEqual([])
  })

  it('preserves existing entityIds on bins', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [],
      bins: [{ id: 'b1', name: 'Bin 1', entityIds: ['e1', 'e2'] }]
    }
    const result = migrateProject(project)
    const bins = result.project.bins as Record<string, unknown>[]
    expect(bins[0].entityIds).toEqual(['e1', 'e2'])
  })

  it('handles entities without extrusion (no pocket added)', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [{ id: 'e1', name: 'Circle 1', type: 'circle' }],
      bins: []
    }
    const result = migrateProject(project)
    const entities = result.project.entities as Record<string, unknown>[]
    expect(entities[0].pocket).toBeUndefined()
  })

  it('defaults depth to 5 for invalid extrusion depth', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [
        {
          id: 'e1',
          name: 'Circle 1',
          type: 'circle',
          extrusion: { depth: -1, direction: 'down', role: 'cutter' }
        }
      ],
      bins: []
    }
    const result = migrateProject(project)
    const entities = result.project.entities as Record<string, unknown>[]
    expect((entities[0].pocket as { depth: number }).depth).toBe(5)
  })
})
