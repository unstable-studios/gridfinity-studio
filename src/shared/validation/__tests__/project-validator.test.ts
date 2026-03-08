import { describe, it, expect } from 'vitest'
import { ProjectValidator, validateProject } from '../project-validator'
import { createEmptyProject, type ProjectData } from '../../types/project'

// ─── Helpers ────────────────────────────────────────────────────────

function projectWith(overrides: Partial<ProjectData>): ProjectData {
  return { ...createEmptyProject('Test'), ...overrides }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('ProjectValidator', () => {
  describe('empty project baseline', () => {
    it('accepts a valid empty project', () => {
      const result = ProjectValidator.validate(createEmptyProject())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('exports a convenience function', () => {
      const result = validateProject(createEmptyProject())
      expect(result.valid).toBe(true)
    })
  })

  describe('required fields', () => {
    it('rejects null', () => {
      const result = ProjectValidator.validate(null)
      expect(result.valid).toBe(false)
    })

    it('rejects empty object', () => {
      const result = ProjectValidator.validate({})
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('Missing required field'))).toBe(true)
    })

    it('requires schemaVersion, settings, gridfinity, layoutSnapshot', () => {
      const result = ProjectValidator.validate({})
      const missing = result.errors.map((e) => e.field)
      expect(missing).toContain('schemaVersion')
      expect(missing).toContain('settings')
      expect(missing).toContain('gridfinity')
      expect(missing).toContain('layoutSnapshot')
    })
  })

  describe('schema version', () => {
    it('rejects non-semver schema version', () => {
      const result = ProjectValidator.validate(projectWith({ schemaVersion: 'not-a-version' }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'schemaVersion')).toBe(true)
    })

    it('accepts valid semver schema version', () => {
      const result = ProjectValidator.validate(createEmptyProject())
      expect(result.valid).toBe(true)
    })
  })

  describe('settings validation', () => {
    it('rejects empty project name', () => {
      const project = createEmptyProject()
      project.settings.name = ''
      const result = ProjectValidator.validate(project)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'settings.name')).toBe(true)
    })

    it('rejects invalid units', () => {
      const result = ProjectValidator.validate(
        projectWith({
          settings: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            units: 'ft' as 'mm'
          }
        })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'settings.units')).toBe(true)
    })
  })

  describe('gridfinity config', () => {
    it('rejects negative baseUnit', () => {
      const project = createEmptyProject()
      project.gridfinity.baseUnit = -1
      const result = ProjectValidator.validate(project)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'gridfinity.baseUnit')).toBe(true)
    })

    it('rejects non-boolean magnet hole enabled', () => {
      const project = createEmptyProject()
      ;(project.gridfinity.magnetHoles as Record<string, unknown>).enabled = 'yes'
      const result = ProjectValidator.validate(project)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'gridfinity.magnetHoles.enabled')).toBe(true)
    })
  })
})
