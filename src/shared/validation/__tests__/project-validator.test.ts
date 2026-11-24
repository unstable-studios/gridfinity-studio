import { describe, it, expect } from 'vitest'
import {
  ProjectValidator,
  repairProject,
  repairLayout,
  validateProject
} from '../project-validator'
import {
  createEmptyProject,
  type LayoutGroupData,
  type LayoutShapeData,
  type ProjectData
} from '../../types/project'

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

    it('rejects a version that is missing, empty or not text', () => {
      // Such a file used to open, and would then skip every conversion.
      for (const schemaVersion of [
        '',
        null,
        undefined,
        0,
        5,
        false,
        '0.5',
        'v0.5.0',
        '0.6.0-beta.1'
      ]) {
        const result = validateProject({ ...createEmptyProject(), schemaVersion })
        expect(result.valid, String(schemaVersion)).toBe(false)
        expect(result.errors.map((e) => e.field)).toContain('schemaVersion')
      }
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

  describe('empty or missing sections', () => {
    it('rejects a section that is present but holds nothing', () => {
      for (const field of ['settings', 'gridfinity', 'layoutSnapshot'] as const) {
        const result = validateProject({ ...createEmptyProject(), [field]: null })
        expect(result.valid, field).toBe(false)
        expect(result.errors.map((e) => e.field)).toContain(field)
      }
    })
  })

  describe('layout', () => {
    const bin = (overrides: Partial<LayoutGroupData> = {}): LayoutGroupData => ({
      id: 'bin',
      x: 0,
      y: 0,
      width: 84,
      height: 42,
      rotation: 0,
      childIds: ['rect'],
      style: { fill: '#fff', stroke: '#000', strokeWidth: 1 },
      metadata: { widthUnits: 2, depthUnits: 1, heightUnits: 3, hasLip: true },
      ...overrides
    })
    const rect = (overrides: Partial<LayoutShapeData> = {}): LayoutShapeData => ({
      id: 'rect',
      type: 'rect',
      x: -21,
      y: 0,
      width: 20,
      height: 12,
      rotation: 0,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 1,
      groupId: 'bin',
      ...overrides
    })
    const withLayout = (
      shapes: unknown[],
      groups: unknown[],
      more: Record<string, unknown> = {}
    ): unknown => {
      const project = createEmptyProject()
      return { ...project, layoutSnapshot: { ...project.layoutSnapshot, shapes, groups, ...more } }
    }
    const fields = (data: unknown): string[] => validateProject(data).errors.map((e) => e.field)

    it('accepts a bin with a pocket of each kind', () => {
      const shapes = [
        rect(),
        rect({ id: 'ellipse', type: 'circle', radiusX: 5, radiusY: 3 }),
        rect({
          id: 'polygon',
          type: 'polygon',
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 0, y: 5 }
          ]
        }),
        rect({ id: 'loose', groupId: null })
      ]
      const result = validateProject(withLayout(shapes, [bin()]))
      expect(result.errors).toEqual([])
    })

    it('rejects a layout whose lists are not lists', () => {
      expect(fields(withLayout([], [], { shapes: {}, groups: 'none' }))).toEqual([
        'layoutSnapshot.shapes',
        'layoutSnapshot.groups'
      ])
    })

    it('rejects a grid with no size', () => {
      const broken = withLayout([], [], { gridConfig: { size: 0, enabled: true, visible: 'yes' } })
      expect(fields(broken)).toEqual([
        'layoutSnapshot.gridConfig.size',
        'layoutSnapshot.gridConfig.visible'
      ])
    })

    it('rejects two things with the same id, bin or shape', () => {
      const twoShapes = withLayout([rect(), rect()], [bin()])
      expect(validateProject(twoShapes).errors[0].message).toBe('Duplicate id: rect')
      const shapeAndBin = withLayout([rect({ id: 'bin', groupId: null })], [bin()])
      expect(validateProject(shapeAndBin).errors[0].message).toBe('Duplicate id: bin')
    })

    it('accepts a shape that says it is in a bin that is not there', () => {
      // `repairLayout` puts it in no bin. Refusing would stop the project being saved.
      expect(fields(withLayout([rect({ groupId: 'gone' })], [bin()]))).toEqual([])
    })

    it('rejects a groupId that is not an id', () => {
      const shapes = [
        rect({ id: 'a', groupId: 5 as unknown as string }),
        rect({ id: 'b', groupId: undefined as unknown as string })
      ]
      expect(fields(withLayout(shapes, [bin()]))).toEqual([
        'layoutSnapshot.shapes[0].groupId',
        'layoutSnapshot.shapes[1].groupId'
      ])
    })

    it('accepts metadata left undefined but not metadata set to nothing', () => {
      const shapes = [
        rect({ id: 'a', metadata: undefined }),
        rect({ id: 'b', metadata: null as never })
      ]
      expect(fields(withLayout(shapes, [bin()]))).toEqual(['layoutSnapshot.shapes[1].metadata'])
    })

    it('leaves lists and objects out of what it reports', () => {
      const { errors } = validateProject(withLayout([], [], { shapes: { a: 1 } }))
      expect(errors[0]).toEqual({
        field: 'layoutSnapshot.shapes',
        message: 'shapes must be a list'
      })
    })

    it('rejects a position or size that is not a number', () => {
      // JSON has no NaN: a broken number is saved as null.
      const broken = withLayout(
        [rect({ x: null as unknown as number, width: '20' as unknown as number })],
        [bin({ height: Infinity })]
      )
      expect(fields(broken)).toEqual([
        'layoutSnapshot.groups[0].height',
        'layoutSnapshot.shapes[0].x',
        'layoutSnapshot.shapes[0].width'
      ])
    })

    it('rejects a shape of an unknown kind or missing what its kind needs', () => {
      const shapes = [
        rect({ id: 'a', type: 'star' as LayoutShapeData['type'] }),
        rect({ id: 'b', type: 'constructor' as LayoutShapeData['type'] }),
        rect({ id: 'c', type: 'circle' }),
        rect({ id: 'd', type: 'polygon', points: [{ x: 0, y: 'up' as unknown as number }] }),
        rect({ id: 'e', type: 'svgPath' })
      ]
      expect(fields(withLayout(shapes, [bin()]))).toEqual([
        'layoutSnapshot.shapes[0].type',
        'layoutSnapshot.shapes[1].type',
        'layoutSnapshot.shapes[2].radiusX',
        'layoutSnapshot.shapes[2].radiusY',
        'layoutSnapshot.shapes[3].points',
        'layoutSnapshot.shapes[4].pathData'
      ])
    })

    it('rejects entries that are not objects', () => {
      expect(fields(withLayout([null, 'shape'], [[]]))).toEqual([
        'layoutSnapshot.groups[0]',
        'layoutSnapshot.shapes[0]',
        'layoutSnapshot.shapes[1]'
      ])
    })

    it('reports only the first problems of a badly broken layout', () => {
      const shapes = Array.from({ length: 100 }, () => null)
      const { errors } = validateProject(withLayout(shapes, []))
      expect(errors).toHaveLength(21)
      expect(errors.at(-1)!.message).toBe('and 80 more problems')
    })

    it('accepts a bin whose list of shapes has drifted from the shapes', () => {
      const drifted = withLayout([rect()], [bin({ childIds: ['other', 'rect', 'rect'] })])
      expect(validateProject(drifted).valid).toBe(true)
    })
  })

  describe('repairLayout', () => {
    const layout = (
      shapes: Array<{ id: string; groupId: string | null }>,
      groups: Array<{ id: string; childIds: string[] }>
    ): ProjectData['layoutSnapshot'] =>
      ({ ...createEmptyProject().layoutSnapshot, shapes, groups }) as ProjectData['layoutSnapshot']

    it('returns the same layout when nothing needs repair', () => {
      const good = layout([{ id: 's', groupId: 'bin' }], [{ id: 'bin', childIds: ['s'] }])
      expect(repairLayout(good)).toBe(good)
    })

    it('lists the shapes that say they are in the bin, keeping the order it had', () => {
      const drifted = layout(
        [
          { id: 'a', groupId: 'bin' },
          { id: 'b', groupId: 'bin' },
          { id: 'c', groupId: null },
          { id: 'd', groupId: 'bin' }
        ],
        [{ id: 'bin', childIds: ['d', 'gone', 'c', 'a', 'd'] }]
      )
      expect(repairLayout(drifted).groups[0].childIds).toEqual(['d', 'a', 'b'])
      // The file as read is left alone.
      expect(drifted.groups[0].childIds).toHaveLength(5)
    })

    it('puts a shape in no bin when its bin is not in the file', () => {
      const dangling = layout(
        [
          { id: 'a', groupId: 'gone' },
          { id: 'b', groupId: 'bin' }
        ],
        [{ id: 'bin', childIds: ['a', 'b'] }]
      )
      const repaired = repairLayout(dangling)
      expect(repaired.shapes.map((shape) => shape.groupId)).toEqual([null, 'bin'])
      expect(repaired.groups[0].childIds).toEqual(['b'])
      expect(dangling.shapes[0].groupId).toBe('gone')
    })

    it('keeps the shapes of each bin apart when there are several bins', () => {
      const two = layout(
        [
          { id: 'a', groupId: 'one' },
          { id: 'b', groupId: 'two' }
        ],
        [
          { id: 'one', childIds: ['b'] },
          { id: 'two', childIds: [] }
        ]
      )
      expect(repairLayout(two).groups.map((group) => group.childIds)).toEqual([['a'], ['b']])
    })

    it('runs when a project is opened', () => {
      const project = createEmptyProject()
      project.layoutSnapshot = layout([{ id: 's', groupId: 'bin' }], [{ id: 'bin', childIds: [] }])
      expect(repairProject(project).layoutSnapshot.groups[0].childIds).toEqual(['s'])
      // A project with nothing to repair comes back as it is.
      const sound = createEmptyProject()
      expect(repairProject(sound)).toBe(sound)
    })
  })
})
