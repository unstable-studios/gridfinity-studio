import { describe, it, expect } from 'vitest'
import type { ProjectData, LayoutSnapshotData } from '../../../../shared/types/project'
import { createEmptyProject, CURRENT_SCHEMA_VERSION } from '../../../../shared/types/project'
import { migrateProject } from '../../../../shared/validation/project-validator'

describe('Layout snapshot persistence', () => {
  it('T052: layoutSnapshot survives project serialization roundtrip', () => {
    const project = createEmptyProject('Test')

    const snapshot: LayoutSnapshotData = {
      version: '1',
      shapes: [
        {
          id: 'r1',
          type: 'rect',
          x: 42,
          y: 42,
          width: 168,
          height: 168,
          rotation: 0,
          fill: '#ccc',
          stroke: '#000',
          strokeWidth: 1,
          groupId: null
        },
        {
          id: 'c1',
          type: 'circle',
          x: 210,
          y: 210,
          radiusX: 42,
          radiusY: 42,
          rotation: 0,
          fill: '#aaa',
          stroke: '#000',
          strokeWidth: 1,
          groupId: 'g1'
        }
      ],
      groups: [
        {
          id: 'g1',
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          rotation: 0,
          childIds: ['c1'],
          style: { fill: 'transparent', stroke: '#666', strokeWidth: 1 }
        }
      ],
      gridConfig: { size: 42, enabled: true, visible: true }
    }

    project.layoutSnapshot = snapshot

    // Simulate save → load (JSON roundtrip)
    const serialized = JSON.stringify(project)
    const loaded: ProjectData = JSON.parse(serialized)

    expect(loaded.layoutSnapshot).toBeDefined()
    expect(loaded.layoutSnapshot!.shapes).toHaveLength(2)
    expect(loaded.layoutSnapshot!.groups).toHaveLength(1)
    expect(loaded.layoutSnapshot!.shapes[0]).toMatchObject({ id: 'r1', type: 'rect' })
    expect(loaded.layoutSnapshot!.shapes[1]).toMatchObject({ id: 'c1', groupId: 'g1' })
    expect(loaded.layoutSnapshot!.groups[0]).toMatchObject({
      id: 'g1',
      childIds: ['c1']
    })
    expect(loaded.layoutSnapshot!.gridConfig).toEqual({
      size: 42,
      enabled: true,
      visible: true
    })
  })

  it('T053: pre-migration .gfstudio file without layoutSnapshot loads correctly', () => {
    // Simulate a v0.3.0 project without layoutSnapshot
    // Simulate a pre-migration file that has no layoutSnapshot field
    const oldProject = {
      schemaVersion: '0.3.0',
      settings: {
        name: 'Old Project',
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        units: 'mm'
      },
      gridfinity: {
        baseUnit: 42,
        gridSpacing: 42,
        unitHeight: 7,
        tolerance: 0.5,
        magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
        screwHoles: { enabled: false, diameter: 3, depth: 6 }
      },
      entities: [
        {
          id: 'e1',
          type: 'rectangle',
          name: 'Rect 1',
          width: 20,
          height: 10,
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          visible: true,
          locked: false,
          properties: {}
        }
      ],
      groups: [],
      generators: [],
      bins: []
    }

    // Roundtrip through JSON (simulate file load)
    const serialized = JSON.stringify(oldProject)
    const loaded = JSON.parse(serialized) as ProjectData

    // Migration should work fine — layoutSnapshot is just absent
    const migrated = migrateProject(loaded)

    expect(migrated.layoutSnapshot).toBeUndefined()
    expect(migrated.entities).toHaveLength(1)
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.settings.name).toBe('Old Project')
  })
})
