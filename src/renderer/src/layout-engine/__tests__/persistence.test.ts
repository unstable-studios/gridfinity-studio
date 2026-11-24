import { describe, it, expect } from 'vitest'
import type { ProjectData, LayoutSnapshotData } from '../../../../shared/types/project'
import { createEmptyProject } from '../../../../shared/types/project'

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
})
