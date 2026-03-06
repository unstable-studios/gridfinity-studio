import { describe, it, expect } from 'vitest'
import {
  createEmptyProject,
  createDefaultTransform,
  type Entity,
  type ProjectData,
  type CircleEntity,
  type RectangleEntity,
  type PolygonEntity
} from '../../../../shared/types/project'

/**
 * These tests verify the entity mutation logic used by useProject.
 * Since useProject is a React hook that requires context + IPC,
 * we test the pure data transformations it performs.
 */

// Simulates addEntity logic from useProject
function addEntityToProject(
  project: ProjectData,
  partial: Partial<Entity> & { type: Entity['type'] }
): { project: ProjectData; entity: Entity } {
  const label = partial.type.charAt(0).toUpperCase() + partial.type.slice(1)
  const existingCount = project.entities.filter((e) => e.type === partial.type).length

  const entity = {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? `${label} ${existingCount + 1}`,
    transform: partial.transform ?? createDefaultTransform(),
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    properties: partial.properties ?? {},
    ...partial
  } as Entity

  return {
    project: { ...project, entities: [...project.entities, entity] },
    entity
  }
}

// Simulates updateEntity logic from useProject
function updateEntityInProject(
  project: ProjectData,
  id: string,
  patch: Partial<Entity>
): ProjectData {
  return {
    ...project,
    entities: project.entities.map((e) => (e.id === id ? ({ ...e, ...patch } as Entity) : e))
  }
}

// Simulates removeEntity logic from useProject
function removeEntityFromProject(project: ProjectData, id: string): ProjectData {
  return {
    ...project,
    entities: project.entities.filter((e) => e.id !== id)
  }
}

describe('entity mutation logic', () => {
  describe('addEntity', () => {
    it('generates a unique ID', () => {
      const project = createEmptyProject()
      const { entity: e1 } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      const { entity: e2 } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(e1.id).toBeTruthy()
      expect(e2.id).toBeTruthy()
      expect(e1.id).not.toBe(e2.id)
    })

    it('generates sequential names by type', () => {
      let project = createEmptyProject()

      const r1 = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project
      expect(r1.entity.name).toBe('Circle 1')

      const r2 = addEntityToProject(project, {
        type: 'circle',
        diameter: 5
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r2.project
      expect(r2.entity.name).toBe('Circle 2')

      const r3 = addEntityToProject(project, {
        type: 'rectangle',
        width: 10,
        height: 5
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      expect(r3.entity.name).toBe('Rectangle 1')
    })

    it('preserves user-provided name', () => {
      const project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        name: 'My Custom Circle'
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(entity.name).toBe('My Custom Circle')
    })

    it('sets default transform when none provided', () => {
      const project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(entity.transform).toEqual(createDefaultTransform())
    })

    it('preserves provided transform', () => {
      const project = createEmptyProject()
      const customTransform = {
        position: { x: 5, y: 10, z: 0 },
        rotation: { x: 0, y: 0, z: 45 },
        scale: { x: 1, y: 1, z: 1 }
      }
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        transform: customTransform
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(entity.transform).toEqual(customTransform)
    })

    it('defaults to visible and unlocked', () => {
      const project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(entity.visible).toBe(true)
      expect(entity.locked).toBe(false)
    })

    it('preserves type-specific fields for circle', () => {
      const project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 15.5
      } as Partial<CircleEntity> & { type: 'circle' })

      expect(entity.type).toBe('circle')
      expect((entity as CircleEntity).diameter).toBe(15.5)
    })

    it('preserves type-specific fields for rectangle', () => {
      const project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'rectangle',
        width: 20,
        height: 10,
        cornerRadius: 2
      } as Partial<RectangleEntity> & { type: 'rectangle' })

      expect(entity.type).toBe('rectangle')
      const rect = entity as RectangleEntity
      expect(rect.width).toBe(20)
      expect(rect.height).toBe(10)
      expect(rect.cornerRadius).toBe(2)
    })

    it('preserves type-specific fields for polygon', () => {
      const project = createEmptyProject()
      const vertices = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 8 }
      ]
      const { entity } = addEntityToProject(project, {
        type: 'polygon',
        vertices
      } as Partial<PolygonEntity> & { type: 'polygon' })

      expect(entity.type).toBe('polygon')
      expect((entity as PolygonEntity).vertices).toEqual(vertices)
    })

    it('appends entity to project entities array', () => {
      let project = createEmptyProject()
      expect(project.entities).toHaveLength(0)

      const r1 = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project
      expect(project.entities).toHaveLength(1)

      const r2 = addEntityToProject(project, {
        type: 'rectangle',
        width: 5,
        height: 5
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r2.project
      expect(project.entities).toHaveLength(2)
    })
  })

  describe('updateEntity', () => {
    it('updates matching entity by ID', () => {
      let project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' }).project
      project = { ...project, entities: [entity, ...project.entities.slice(1)] }

      const updated = updateEntityInProject(project, entity.id, { name: 'Renamed' })
      const found = updated.entities.find((e) => e.id === entity.id)

      expect(found).toBeDefined()
      expect(found!.name).toBe('Renamed')
    })

    it('does not affect other entities', () => {
      let project = createEmptyProject()
      const r1 = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        id: 'a'
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project
      const r2 = addEntityToProject(project, {
        type: 'rectangle',
        width: 5,
        height: 5,
        id: 'b'
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r2.project

      const updated = updateEntityInProject(project, 'a', { name: 'Changed' })

      expect(updated.entities.find((e) => e.id === 'a')!.name).toBe('Changed')
      expect(updated.entities.find((e) => e.id === 'b')!.name).toBe(r2.entity.name)
    })

    it('can update transform position', () => {
      let project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        id: 'c'
      } as Partial<CircleEntity> & { type: 'circle' })
      project = { ...project, entities: [entity] }

      const newTransform = {
        ...entity.transform,
        position: { x: 42, y: 84, z: 0 }
      }
      const updated = updateEntityInProject(project, 'c', { transform: newTransform })

      expect(updated.entities[0].transform.position).toEqual({ x: 42, y: 84, z: 0 })
    })

    it('can add extrusion config', () => {
      let project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        id: 'd'
      } as Partial<CircleEntity> & { type: 'circle' })
      project = { ...project, entities: [entity] }

      const updated = updateEntityInProject(project, 'd', {
        pocket: { depth: 5, clearance: 0.2 }
      })

      expect(updated.entities[0].pocket).toEqual({
        depth: 5,
        clearance: 0.2
      })
    })

    it('no-ops for non-existent ID', () => {
      let project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = { ...project, entities: [entity] }

      const updated = updateEntityInProject(project, 'nonexistent', { name: 'Ghost' })

      expect(updated.entities).toHaveLength(1)
      expect(updated.entities[0].name).toBe(entity.name)
    })
  })

  describe('removeEntity', () => {
    it('removes entity by ID', () => {
      let project = createEmptyProject()
      const { entity } = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        id: 'del1'
      } as Partial<CircleEntity> & { type: 'circle' })
      project = { ...project, entities: [entity] }

      const updated = removeEntityFromProject(project, 'del1')

      expect(updated.entities).toHaveLength(0)
    })

    it('preserves other entities', () => {
      let project = createEmptyProject()
      const r1 = addEntityToProject(project, {
        type: 'circle',
        diameter: 10,
        id: 'keep'
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project
      const r2 = addEntityToProject(project, {
        type: 'rectangle',
        width: 5,
        height: 5,
        id: 'remove'
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r2.project

      const updated = removeEntityFromProject(project, 'remove')

      expect(updated.entities).toHaveLength(1)
      expect(updated.entities[0].id).toBe('keep')
    })

    it('no-ops for non-existent ID', () => {
      let project = createEmptyProject()
      const r1 = addEntityToProject(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project

      const updated = removeEntityFromProject(project, 'nonexistent')

      expect(updated.entities).toHaveLength(1)
    })
  })
})
