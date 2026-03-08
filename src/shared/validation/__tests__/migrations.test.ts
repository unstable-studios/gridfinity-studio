import { describe, it, expect } from 'vitest'
import { migrateProject } from '../migrations'
import { CURRENT_SCHEMA_VERSION } from '../../types/project'

describe('migrateProject', () => {
  it('returns current-version projects unchanged', () => {
    const project = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      entities: [],
      bins: [],
      layoutSnapshot: {
        version: '1.0.0',
        shapes: [],
        groups: [],
        gridConfig: { size: 42, enabled: true, visible: true }
      }
    }
    const result = migrateProject(project)
    expect(result.warnings).toEqual([])
    expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('migrates v0.2.0 → current: converts extrusion to pocket and creates layoutSnapshot', () => {
    const project = {
      schemaVersion: '0.2.0',
      entities: [
        {
          id: 'e1',
          name: 'Circle 1',
          type: 'circle',
          diameter: 20,
          transform: {
            position: { x: 10, y: 20, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          extrusion: { depth: 10, direction: 'down', role: 'cutter' }
        }
      ],
      bins: [{ id: 'b1', name: 'Bin 1' }]
    }
    const result = migrateProject(project)
    expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    // Extrusion → pocket migration
    const entities = result.project.entities as Record<string, unknown>[]
    expect(entities[0].pocket).toEqual({ depth: 10, clearance: 0.2 })
    expect(entities[0].extrusion).toBeUndefined()

    // Layout snapshot created
    const snapshot = result.project.layoutSnapshot as Record<string, unknown>
    expect(snapshot).toBeDefined()
    const shapes = snapshot.shapes as Record<string, unknown>[]
    expect(shapes).toHaveLength(1)
    expect(shapes[0].type).toBe('circle')
    expect(shapes[0].radiusX).toBe(10)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('Migrated project from v0.2.0')
  })

  it('migrates v0.1.0 → current', () => {
    const project = {
      schemaVersion: '0.1.0',
      entities: [
        {
          id: 'e1',
          name: 'Rect 1',
          type: 'rectangle',
          width: 42,
          height: 21,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          extrusion: { depth: 3, direction: 'up', role: 'solid' }
        }
      ],
      bins: []
    }
    const result = migrateProject(project)
    expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const entities = result.project.entities as Record<string, unknown>[]
    expect(entities[0].pocket).toEqual({ depth: 3, clearance: 0.2 })

    const snapshot = result.project.layoutSnapshot as Record<string, unknown>
    const shapes = snapshot.shapes as Record<string, unknown>[]
    expect(shapes).toHaveLength(1)
    expect(shapes[0].type).toBe('rect')
    expect(shapes[0].width).toBe(42)
    expect(shapes[0].height).toBe(21)
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

  it('migrates v0.4.0 → v0.5.0: converts entities and bins to layoutSnapshot', () => {
    const project = {
      schemaVersion: '0.4.0',
      gridfinity: { baseUnit: 42 },
      entities: [
        {
          id: 'e1',
          type: 'polygon',
          name: 'Poly',
          vertices: [
            { x: 0, y: -10 },
            { x: 10, y: 10 },
            { x: -10, y: 10 }
          ],
          transform: {
            position: { x: 50, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          pocket: { depth: 5, clearance: 0.2 },
          properties: {}
        }
      ],
      bins: [
        {
          id: 'b1',
          name: 'Bin 1',
          width: 2,
          depth: 3,
          height: 4,
          position: { x: 0, y: 0 },
          hasStackingLip: true,
          entityIds: ['e1']
        }
      ]
    }
    const result = migrateProject(project)
    expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const snapshot = result.project.layoutSnapshot as Record<string, unknown>
    expect(snapshot).toBeDefined()

    const shapes = snapshot.shapes as Record<string, unknown>[]
    expect(shapes).toHaveLength(1)
    expect(shapes[0].type).toBe('polygon')
    expect(shapes[0].x).toBe(50)
    expect(shapes[0].y).toBe(50)

    const groups = snapshot.groups as Record<string, unknown>[]
    expect(groups).toHaveLength(1)
    expect(groups[0].width).toBe(84) // 2 * 42
    expect(groups[0].height).toBe(126) // 3 * 42
    const meta = groups[0].metadata as Record<string, unknown>
    expect(meta.widthUnits).toBe(2)
    expect(meta.depthUnits).toBe(3)
    expect(meta.hasLip).toBe(true)
  })
})
