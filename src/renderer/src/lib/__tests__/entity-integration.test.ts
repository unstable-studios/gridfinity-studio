import { describe, it, expect } from 'vitest'
import {
  createEmptyProject,
  createDefaultTransform,
  type Entity,
  type ProjectData,
  type CircleEntity,
  type RectangleEntity,
  type PolygonEntity,
  type ExtrusionConfig
} from '../../../../shared/types/project'
import { validateProject } from '../../../../shared/validation/project-validator'

/**
 * Integration tests for the entity creation round-trip.
 *
 * These verify that the data transformations in the tool → addEntity → project state
 * pipeline produce valid, consistent project data at each stage.
 * We can't test React rendering in a node environment, but we CAN verify
 * that the data each component produces is correct and valid.
 */

// Simulates what happens when a tool calls onPlace → addEntity
function simulateEntityCreation(
  project: ProjectData,
  toolOutput: Partial<Entity> & { type: Entity['type'] }
): { project: ProjectData; entity: Entity } {
  const label = toolOutput.type.charAt(0).toUpperCase() + toolOutput.type.slice(1)
  const existingCount = project.entities.filter((e) => e.type === toolOutput.type).length

  const entity = {
    id: toolOutput.id ?? crypto.randomUUID(),
    name: toolOutput.name ?? `${label} ${existingCount + 1}`,
    transform: toolOutput.transform ?? createDefaultTransform(),
    visible: toolOutput.visible ?? true,
    locked: toolOutput.locked ?? false,
    properties: toolOutput.properties ?? {},
    ...toolOutput
  } as Entity

  const updated = { ...project, entities: [...project.entities, entity] }
  return { project: updated, entity }
}

describe('entity creation round-trip', () => {
  describe('CircleTool → addEntity → valid project', () => {
    it('circle tool output produces valid entity in project', () => {
      const project = createEmptyProject()

      // Simulates what CircleTool.onPlace emits
      const toolOutput = {
        type: 'circle' as const,
        diameter: 15,
        transform: {
          position: { x: 21, y: 21, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      }

      const { project: updated, entity } = simulateEntityCreation(project, toolOutput)

      expect(entity.type).toBe('circle')
      expect((entity as CircleEntity).diameter).toBe(15)
      expect(entity.transform.position).toEqual({ x: 21, y: 21, z: 0 })
      expect(entity.name).toBe('Circle 1')

      // Project should pass validation
      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })
  })

  describe('RectangleTool → addEntity → valid project', () => {
    it('rectangle tool output produces valid entity in project', () => {
      const project = createEmptyProject()

      const toolOutput = {
        type: 'rectangle' as const,
        width: 20,
        height: 10,
        transform: {
          position: { x: 10, y: 5, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      }

      const { project: updated, entity } = simulateEntityCreation(project, toolOutput)

      expect(entity.type).toBe('rectangle')
      const rect = entity as RectangleEntity
      expect(rect.width).toBe(20)
      expect(rect.height).toBe(10)
      expect(entity.name).toBe('Rectangle 1')

      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })
  })

  describe('PolygonTool → addEntity → valid project', () => {
    it('polygon tool output produces valid entity in project', () => {
      const project = createEmptyProject()

      // Simulates what PolygonTool.onPlace emits after closing
      const toolOutput = {
        type: 'polygon' as const,
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      }

      const { project: updated, entity } = simulateEntityCreation(project, toolOutput)

      expect(entity.type).toBe('polygon')
      expect((entity as PolygonEntity).vertices).toHaveLength(4)
      expect(entity.name).toBe('Polygon 1')

      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })
  })

  describe('multiple entity creation', () => {
    it('creates entities with unique IDs and sequential names', () => {
      let project = createEmptyProject()

      const r1 = simulateEntityCreation(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project

      const r2 = simulateEntityCreation(project, {
        type: 'circle',
        diameter: 20
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r2.project

      const r3 = simulateEntityCreation(project, {
        type: 'rectangle',
        width: 5,
        height: 5
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r3.project

      expect(project.entities).toHaveLength(3)
      expect(r1.entity.id).not.toBe(r2.entity.id)
      expect(r1.entity.name).toBe('Circle 1')
      expect(r2.entity.name).toBe('Circle 2')
      expect(r3.entity.name).toBe('Rectangle 1')

      const validation = validateProject(project)
      expect(validation.valid).toBe(true)
    })
  })

  describe('entity update preserves project validity', () => {
    it('updating position keeps project valid', () => {
      let project = createEmptyProject()
      const { entity } = simulateEntityCreation(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = { ...project, entities: [entity] }

      // Simulates TransformGizmo drag → updateEntity
      const updated = {
        ...project,
        entities: project.entities.map((e) =>
          e.id === entity.id
            ? {
                ...e,
                transform: {
                  ...e.transform,
                  position: { x: 42, y: 84, z: 0 }
                }
              }
            : e
        )
      }

      expect(updated.entities[0].transform.position).toEqual({ x: 42, y: 84, z: 0 })
      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })

    it('adding extrusion keeps project valid', () => {
      let project = createEmptyProject()
      const { entity } = simulateEntityCreation(project, {
        type: 'rectangle',
        width: 20,
        height: 10
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = { ...project, entities: [entity] }

      const extrusion: ExtrusionConfig = { depth: 5, direction: 'down', role: 'cutter' }
      const updated = {
        ...project,
        entities: project.entities.map((e) => (e.id === entity.id ? { ...e, extrusion } : e))
      }

      expect(updated.entities[0].extrusion).toEqual(extrusion)
      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })
  })

  describe('entity removal preserves project validity', () => {
    it('removing an entity keeps project valid', () => {
      let project = createEmptyProject()
      const r1 = simulateEntityCreation(project, {
        type: 'circle',
        diameter: 10
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project
      const r2 = simulateEntityCreation(project, {
        type: 'rectangle',
        width: 5,
        height: 5
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r2.project

      const updated = {
        ...project,
        entities: project.entities.filter((e) => e.id !== r1.entity.id)
      }

      expect(updated.entities).toHaveLength(1)
      expect(updated.entities[0].id).toBe(r2.entity.id)

      const validation = validateProject(updated)
      expect(validation.valid).toBe(true)
    })
  })

  describe('save/load round-trip', () => {
    it('project with entities survives JSON serialization', () => {
      let project = createEmptyProject('Test')

      const r1 = simulateEntityCreation(project, {
        type: 'circle',
        diameter: 15,
        transform: {
          position: { x: 21, y: 21, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      } as Partial<CircleEntity> & { type: 'circle' })
      project = r1.project

      const r2 = simulateEntityCreation(project, {
        type: 'rectangle',
        width: 20,
        height: 10,
        extrusion: { depth: 5, direction: 'down', role: 'cutter' }
      } as Partial<RectangleEntity> & { type: 'rectangle' })
      project = r2.project

      // Simulate save → load via JSON
      const serialized = JSON.stringify(project)
      const deserialized = JSON.parse(serialized) as ProjectData

      expect(deserialized.entities).toHaveLength(2)
      expect(deserialized.entities[0].type).toBe('circle')
      expect((deserialized.entities[0] as CircleEntity).diameter).toBe(15)
      expect(deserialized.entities[1].type).toBe('rectangle')
      expect(deserialized.entities[1].extrusion).toEqual({
        depth: 5,
        direction: 'down',
        role: 'cutter'
      })

      const validation = validateProject(deserialized)
      expect(validation.valid).toBe(true)
    })
  })
})
