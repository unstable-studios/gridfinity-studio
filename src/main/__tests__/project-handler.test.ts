import { describe, it, expect } from 'vitest'
import { newProject, getRecentProjects, validateProjectData } from '../project-handler'
import { CURRENT_SCHEMA_VERSION, createEmptyProject } from '../../shared/types/project'

describe('project-handler', () => {
  describe('newProject', () => {
    it('returns success with a valid empty project', () => {
      const result = newProject()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('returns project with current schema version', () => {
      const result = newProject()

      expect(result.data!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('returns project with default settings', () => {
      const result = newProject()
      const project = result.data!

      expect(project.settings.name).toBe('Untitled Project')
      expect(project.settings.units).toBe('mm')
      expect(project.settings.createdAt).toBeTruthy()
      expect(project.settings.modifiedAt).toBeTruthy()
    })

    it('returns project with empty collections', () => {
      const result = newProject()
      const project = result.data!

      expect(project.entities).toEqual([])
      expect(project.groups).toEqual([])
      expect(project.generators).toEqual([])
      expect(project.bins).toEqual([])
    })

    it('returns project with default gridfinity config', () => {
      const result = newProject()
      const project = result.data!

      expect(project.gridfinity.baseUnit).toBe(42)
      expect(project.gridfinity.unitHeight).toBe(7)
      expect(project.gridfinity.magnetHoles).toEqual({
        enabled: true,
        diameter: 6.5,
        depth: 2.4
      })
    })
  })

  describe('getRecentProjects', () => {
    it('returns success with an array', async () => {
      const result = await getRecentProjects()

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('returns a copy of the recent projects list', async () => {
      const result1 = await getRecentProjects()
      const result2 = await getRecentProjects()

      expect(result1.data).not.toBe(result2.data)
      expect(result1.data).toEqual(result2.data)
    })
  })

  describe('validateProjectData', () => {
    it('returns success for a valid project', () => {
      const project = createEmptyProject('Test Project')
      const result = validateProjectData(project)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns failure for null input', () => {
      const result = validateProjectData(null)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('returns failure for empty object', () => {
      const result = validateProjectData({})

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('returns failure for non-semver schemaVersion', () => {
      const project = createEmptyProject()
      const invalid = { ...project, schemaVersion: 'not-a-version' }
      const result = validateProjectData(invalid)

      expect(result.success).toBe(false)
    })

    it('returns failure for invalid entity', () => {
      const project = createEmptyProject()
      const invalid = {
        ...project,
        entities: [{ type: 'circle', id: 'test', name: 'bad circle' }]
      }
      const result = validateProjectData(invalid)

      expect(result.success).toBe(false)
    })
  })
})
