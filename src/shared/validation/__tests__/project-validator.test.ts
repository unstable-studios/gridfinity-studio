import { describe, it, expect } from 'vitest'
import { ProjectValidator, validateProject } from '../project-validator'
import {
  createEmptyProject,
  createDefaultTransform,
  ENTITY_TYPES,
  type ProjectData,
  type Entity,
  type Bin,
  type Generator
} from '../../types/project'

// ─── Helpers ────────────────────────────────────────────────────────

function makeBaseEntity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'entity-1',
    name: 'Test Entity',
    transform: createDefaultTransform(),
    visible: true,
    locked: false,
    properties: {},
    ...overrides
  }
}

function projectWith(overrides: Partial<ProjectData>): ProjectData {
  return { ...createEmptyProject('Test'), ...overrides }
}

function projectWithEntity(entity: Record<string, unknown>): ProjectData {
  return projectWith({ entities: [entity as unknown as Entity] })
}

function projectWithBin(bin: Record<string, unknown>, entities: Entity[] = []): ProjectData {
  return projectWith({ entities, bins: [bin as unknown as Bin] })
}

function projectWithGenerator(generator: Record<string, unknown>): ProjectData {
  return projectWith({ generators: [generator as unknown as Generator] })
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

  // ── 1. Circle entity ────────────────────────────────────────────

  describe('circle entity', () => {
    it('accepts a valid circle', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: 10 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects diameter <= 0', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: 0 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].diameter',
            message: expect.stringContaining('greater than 0')
          })
        ])
      )
    })

    it('rejects negative diameter', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: -5 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].diameter')).toBe(true)
    })

    it('rejects missing diameter', () => {
      const entity = makeBaseEntity({ type: 'circle' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].diameter')).toBe(true)
    })
  })

  // ── 2. Rectangle entity ─────────────────────────────────────────

  describe('rectangle entity', () => {
    it('accepts a valid rectangle', () => {
      const entity = makeBaseEntity({ type: 'rectangle', width: 20, height: 15 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('accepts rectangle with cornerRadius', () => {
      const entity = makeBaseEntity({ type: 'rectangle', width: 20, height: 15, cornerRadius: 3 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects width <= 0', () => {
      const entity = makeBaseEntity({ type: 'rectangle', width: 0, height: 15 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].width')).toBe(true)
    })

    it('rejects height <= 0', () => {
      const entity = makeBaseEntity({ type: 'rectangle', width: 20, height: -1 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].height')).toBe(true)
    })

    it('rejects negative cornerRadius', () => {
      const entity = makeBaseEntity({
        type: 'rectangle',
        width: 20,
        height: 15,
        cornerRadius: -1
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].cornerRadius',
            message: expect.stringContaining('non-negative')
          })
        ])
      )
    })

    it('accepts cornerRadius of 0', () => {
      const entity = makeBaseEntity({ type: 'rectangle', width: 20, height: 15, cornerRadius: 0 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })
  })

  // ── 3. Polygon entity ───────────────────────────────────────────

  describe('polygon entity', () => {
    it('accepts a valid polygon with 3 vertices', () => {
      const entity = makeBaseEntity({
        type: 'polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 }
        ]
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('accepts a polygon with more than 3 vertices', () => {
      const entity = makeBaseEntity({
        type: 'polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 5, y: 15 }
        ]
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects fewer than 3 vertices', () => {
      const entity = makeBaseEntity({
        type: 'polygon',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].vertices',
            message: expect.stringContaining('at least 3')
          })
        ])
      )
    })

    it('rejects invalid vertex format (missing y)', () => {
      const entity = makeBaseEntity({
        type: 'polygon',
        vertices: [{ x: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].vertices[0]')).toBe(true)
    })

    it('rejects non-object vertex', () => {
      const entity = makeBaseEntity({
        type: 'polygon',
        vertices: ['bad', { x: 10, y: 0 }, { x: 5, y: 10 }]
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].vertices[0]')).toBe(true)
    })

    it('rejects vertices that is not an array', () => {
      const entity = makeBaseEntity({ type: 'polygon', vertices: 'not-an-array' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].vertices')).toBe(true)
    })
  })

  // ── 4. SVG region entity ────────────────────────────────────────

  describe('svg-region entity', () => {
    it('accepts a valid svg-region', () => {
      const entity = makeBaseEntity({ type: 'svg-region', pathData: 'M 0 0 L 10 10 Z' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects empty pathData', () => {
      const entity = makeBaseEntity({ type: 'svg-region', pathData: '' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].pathData',
            message: expect.stringContaining('non-empty string')
          })
        ])
      )
    })

    it('rejects missing pathData', () => {
      const entity = makeBaseEntity({ type: 'svg-region' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].pathData')).toBe(true)
    })
  })

  // ── 5. Mesh entity ──────────────────────────────────────────────

  describe('mesh entity', () => {
    it('accepts a valid mesh', () => {
      const entity = makeBaseEntity({ type: 'mesh', sourceFile: 'model.stl' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects empty sourceFile', () => {
      const entity = makeBaseEntity({ type: 'mesh', sourceFile: '' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].sourceFile',
            message: expect.stringContaining('non-empty string')
          })
        ])
      )
    })

    it('rejects missing sourceFile', () => {
      const entity = makeBaseEntity({ type: 'mesh' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].sourceFile')).toBe(true)
    })
  })

  // ── 6. Pocket config ───────────────────────────────────────────

  describe('pocket config', () => {
    it('accepts a valid pocket', () => {
      const entity = makeBaseEntity({
        type: 'circle',
        diameter: 10,
        pocket: { depth: 5, clearance: 0.2 }
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('accepts zero clearance', () => {
      const entity = makeBaseEntity({
        type: 'circle',
        diameter: 10,
        pocket: { depth: 3, clearance: 0 }
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })

    it('rejects depth <= 0', () => {
      const entity = makeBaseEntity({
        type: 'circle',
        diameter: 10,
        pocket: { depth: 0, clearance: 0.2 }
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].pocket.depth',
            message: expect.stringContaining('greater than 0')
          })
        ])
      )
    })

    it('rejects negative depth', () => {
      const entity = makeBaseEntity({
        type: 'circle',
        diameter: 10,
        pocket: { depth: -2, clearance: 0.2 }
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'entities[0].pocket.depth')).toBe(true)
    })

    it('rejects negative clearance', () => {
      const entity = makeBaseEntity({
        type: 'circle',
        diameter: 10,
        pocket: { depth: 5, clearance: -0.1 }
      })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].pocket.clearance',
            message: expect.stringContaining('non-negative')
          })
        ])
      )
    })

    it('entity without pocket is still valid', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: 10 })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(true)
    })
  })

  // ── 7. Linear pattern generator ─────────────────────────────────

  describe('linear-pattern generator', () => {
    function makeLinearPattern(
      configOverrides: Record<string, unknown> = {}
    ): Record<string, unknown> {
      return {
        id: 'gen-1',
        name: 'Test Pattern',
        type: 'linear-pattern',
        enabled: true,
        config: {
          axis: 'x',
          count: 3,
          spacingMode: 'constant-pitch',
          constantPitch: 10,
          ...configOverrides
        }
      }
    }

    it('accepts a valid linear-pattern with constant-pitch', () => {
      const gen = makeLinearPattern()
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(true)
    })

    it('accepts a valid linear-pattern with size-aware mode', () => {
      const gen = makeLinearPattern({ spacingMode: 'size-aware', gap: 2 })
      delete (gen.config as Record<string, unknown>).constantPitch
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(true)
    })

    it('accepts a valid linear-pattern with explicit mode', () => {
      const gen = makeLinearPattern({
        spacingMode: 'explicit',
        positions: [0, 10, 20],
        count: 3
      })
      delete (gen.config as Record<string, unknown>).constantPitch
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(true)
    })

    it('rejects count < 1', () => {
      const gen = makeLinearPattern({ count: 0 })
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'generators[0].config.count',
            message: expect.stringContaining('>= 1')
          })
        ])
      )
    })

    it('rejects constant-pitch with invalid pitch (<= 0)', () => {
      const gen = makeLinearPattern({ spacingMode: 'constant-pitch', constantPitch: 0 })
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'generators[0].config.constantPitch',
            message: expect.stringContaining('greater than 0')
          })
        ])
      )
    })

    it('rejects constant-pitch with missing pitch', () => {
      const gen = makeLinearPattern({ spacingMode: 'constant-pitch' })
      delete (gen.config as Record<string, unknown>).constantPitch
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'generators[0].config.constantPitch')).toBe(true)
    })

    it('rejects explicit mode when positions length mismatches count', () => {
      const gen = makeLinearPattern({
        spacingMode: 'explicit',
        positions: [0, 10],
        count: 3
      })
      delete (gen.config as Record<string, unknown>).constantPitch
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'generators[0].config.positions',
            message: expect.stringContaining('must equal count')
          })
        ])
      )
    })

    it('rejects explicit mode when positions is not an array', () => {
      const gen = makeLinearPattern({
        spacingMode: 'explicit',
        positions: 'bad',
        count: 2
      })
      delete (gen.config as Record<string, unknown>).constantPitch
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'generators[0].config.positions')).toBe(true)
    })

    it('rejects invalid axis', () => {
      const gen = makeLinearPattern({ axis: 'z' })
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'generators[0].config.axis')).toBe(true)
    })

    it('rejects invalid spacingMode', () => {
      const gen = makeLinearPattern({ spacingMode: 'random' })
      const result = ProjectValidator.validate(projectWithGenerator(gen))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'generators[0].config.spacingMode')).toBe(true)
    })
  })

  // ── 8. Bin entityIds ────────────────────────────────────────────

  describe('bin entityIds', () => {
    it('accepts valid entityIds referencing existing entities', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: 10 }) as unknown as Entity
      const bin = {
        id: 'bin-1',
        name: 'Test Bin',
        width: 1,
        depth: 1,
        height: 1,
        hasDividers: false,
        hasLabel: false,
        hasStackingLip: true,
        entityIds: ['entity-1'],
        properties: {}
      }
      const result = ProjectValidator.validate(projectWithBin(bin, [entity]))
      expect(result.valid).toBe(true)
    })

    it('rejects entityIds referencing non-existent entity', () => {
      const entity = makeBaseEntity({ type: 'circle', diameter: 10 }) as unknown as Entity
      const bin = {
        id: 'bin-1',
        name: 'Test Bin',
        width: 1,
        depth: 1,
        height: 1,
        hasDividers: false,
        hasLabel: false,
        hasStackingLip: true,
        entityIds: ['does-not-exist'],
        properties: {}
      }
      const result = ProjectValidator.validate(projectWithBin(bin, [entity]))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'bins[0].entityIds[0]',
            message: expect.stringContaining('does not exist')
          })
        ])
      )
    })

    it('accepts empty entityIds array', () => {
      const bin = {
        id: 'bin-1',
        name: 'Test Bin',
        width: 1,
        depth: 1,
        height: 1,
        hasDividers: false,
        hasLabel: false,
        hasStackingLip: true,
        entityIds: [],
        properties: {}
      }
      const result = ProjectValidator.validate(projectWithBin(bin))
      expect(result.valid).toBe(true)
    })

    it('rejects entityIds that is not an array', () => {
      const bin = {
        id: 'bin-1',
        name: 'Test Bin',
        width: 1,
        depth: 1,
        height: 1,
        hasDividers: false,
        hasLabel: false,
        hasStackingLip: true,
        entityIds: 'not-array',
        properties: {}
      }
      const result = ProjectValidator.validate(projectWithBin(bin))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === 'bins[0].entityIds')).toBe(true)
    })
  })

  // ── 9. Legacy entity types ──────────────────────────────────────

  describe('legacy entity types (backward compatibility)', () => {
    const legacyTypes = ['bin', 'divider', 'label', 'custom'] as const

    legacyTypes.forEach((type) => {
      it(`accepts legacy type "${type}"`, () => {
        const entity = makeBaseEntity({ type })
        const result = ProjectValidator.validate(projectWithEntity(entity))
        expect(result.valid).toBe(true)
      })
    })
  })

  // ── 10. New entity types in ENTITY_TYPES enum ───────────────────

  describe('entity type enum', () => {
    const newTypes = ['circle', 'rectangle', 'polygon', 'svg-region', 'mesh'] as const

    newTypes.forEach((type) => {
      it(`ENTITY_TYPES includes "${type}"`, () => {
        expect(ENTITY_TYPES).toContain(type)
      })
    })

    it('rejects unknown entity type', () => {
      const entity = makeBaseEntity({ type: 'unknown-type' })
      const result = ProjectValidator.validate(projectWithEntity(entity))
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'entities[0].type',
            message: expect.stringContaining('must be one of')
          })
        ])
      )
    })

    it('ENTITY_TYPES contains all expected types', () => {
      const expected = [
        'bin',
        'divider',
        'label',
        'custom',
        'circle',
        'rectangle',
        'polygon',
        'svg-region',
        'mesh'
      ]
      expect(ENTITY_TYPES).toEqual(expect.arrayContaining(expected))
      expect(ENTITY_TYPES).toHaveLength(expected.length)
    })
  })

  // ── Duplicate entity IDs ────────────────────────────────────────

  describe('duplicate ID detection', () => {
    it('rejects duplicate entity IDs', () => {
      const e1 = makeBaseEntity({ id: 'dup', type: 'circle', diameter: 5 })
      const e2 = makeBaseEntity({ id: 'dup', type: 'circle', diameter: 10 })
      const result = ProjectValidator.validate(
        projectWith({ entities: [e1, e2] as unknown as Entity[] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Duplicate entity ID')
          })
        ])
      )
    })
  })
})
