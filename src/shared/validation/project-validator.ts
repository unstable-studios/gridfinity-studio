import type { ProjectData } from '../types/project'
import { SUPPORTED_SCHEMA_VERSIONS, ENTITY_TYPES } from '../types/project'

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export class ProjectValidator {
  static validate(data: unknown): ValidationResult {
    const errors: ValidationError[] = []

    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: [{ field: 'root', message: 'Project data must be an object' }]
      }
    }

    const project = data as Partial<ProjectData>

    this.validateRequired(project, errors)
    this.validateSchemaVersion(project, errors)

    if (project.settings) {
      this.validateSettings(project.settings, errors)
    }

    if (project.gridfinity) {
      this.validateGridfinity(project.gridfinity, errors)
    }

    if (project.entities) {
      this.validateEntities(project.entities, errors)
    }

    if (project.groups) {
      this.validateGroups(project.groups, project.entities, errors)
    }

    if (project.generators) {
      this.validateGenerators(project.generators, errors)
    }

    if (project.bins) {
      this.validateBins(project.bins, project.entities, errors)
    }

    return { valid: errors.length === 0, errors }
  }

  private static validateRequired(project: Partial<ProjectData>, errors: ValidationError[]): void {
    const required = [
      'schemaVersion',
      'settings',
      'gridfinity',
      'entities',
      'groups',
      'generators',
      'bins'
    ]

    for (const field of required) {
      if (!(field in project)) {
        errors.push({ field, message: `Missing required field: ${field}` })
      }
    }
  }

  private static validateSchemaVersion(
    project: Partial<ProjectData>,
    errors: ValidationError[]
  ): void {
    if (!project.schemaVersion) return

    if (typeof project.schemaVersion !== 'string') {
      errors.push({
        field: 'schemaVersion',
        message: 'Schema version must be a string',
        value: project.schemaVersion
      })
      return
    }

    const versionRegex = /^\d+\.\d+\.\d+$/
    if (!versionRegex.test(project.schemaVersion)) {
      errors.push({
        field: 'schemaVersion',
        message: 'Schema version must follow semver format (e.g., "0.1.0")',
        value: project.schemaVersion
      })
    }

    if (!SUPPORTED_SCHEMA_VERSIONS.includes(project.schemaVersion)) {
      console.warn(
        `Project schema version (${project.schemaVersion}) is not in supported versions. Migration may be needed.`
      )
    }
  }

  private static validateSettings(settings: unknown, errors: ValidationError[]): void {
    if (typeof settings !== 'object' || !settings) {
      errors.push({ field: 'settings', message: 'Settings must be an object', value: settings })
      return
    }

    const s = settings as Record<string, unknown>

    if (!s.name || typeof s.name !== 'string' || s.name.length === 0) {
      errors.push({
        field: 'settings.name',
        message: 'Project name is required and must be a non-empty string',
        value: s.name
      })
    }

    if (!s.createdAt || typeof s.createdAt !== 'string') {
      errors.push({
        field: 'settings.createdAt',
        message: 'Created date is required and must be an ISO 8601 string',
        value: s.createdAt
      })
    }

    if (!s.modifiedAt || typeof s.modifiedAt !== 'string') {
      errors.push({
        field: 'settings.modifiedAt',
        message: 'Modified date is required and must be an ISO 8601 string',
        value: s.modifiedAt
      })
    }

    if (!s.units || !['mm', 'cm', 'in'].includes(s.units as string)) {
      errors.push({
        field: 'settings.units',
        message: 'Units must be one of: mm, cm, in',
        value: s.units
      })
    }
  }

  private static validateGridfinity(config: unknown, errors: ValidationError[]): void {
    if (typeof config !== 'object' || !config) {
      errors.push({
        field: 'gridfinity',
        message: 'Gridfinity config must be an object',
        value: config
      })
      return
    }

    const c = config as Record<string, unknown>

    const numericFields = ['baseUnit', 'gridSpacing', 'unitHeight', 'tolerance']
    for (const field of numericFields) {
      if (typeof c[field] !== 'number') {
        errors.push({
          field: `gridfinity.${field}`,
          message: `${field} must be a number`,
          value: c[field]
        })
      } else if ((c[field] as number) <= 0 && field !== 'tolerance') {
        errors.push({
          field: `gridfinity.${field}`,
          message: `${field} must be greater than 0`,
          value: c[field]
        })
      }
    }

    this.validateHolesConfig(c.magnetHoles, 'magnetHoles', errors)
    this.validateHolesConfig(c.screwHoles, 'screwHoles', errors)
  }

  private static validateHolesConfig(
    config: unknown,
    fieldName: string,
    errors: ValidationError[]
  ): void {
    if (!config || typeof config !== 'object') {
      errors.push({
        field: `gridfinity.${fieldName}`,
        message: `${fieldName} must be an object`,
        value: config
      })
      return
    }

    const c = config as Record<string, unknown>

    if (typeof c.enabled !== 'boolean') {
      errors.push({
        field: `gridfinity.${fieldName}.enabled`,
        message: 'enabled must be a boolean',
        value: c.enabled
      })
    }

    if (typeof c.diameter !== 'number' || c.diameter < 0) {
      errors.push({
        field: `gridfinity.${fieldName}.diameter`,
        message: 'diameter must be a non-negative number',
        value: c.diameter
      })
    }

    if (typeof c.depth !== 'number' || c.depth < 0) {
      errors.push({
        field: `gridfinity.${fieldName}.depth`,
        message: 'depth must be a non-negative number',
        value: c.depth
      })
    }
  }

  private static validateEntities(entities: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(entities)) {
      errors.push({ field: 'entities', message: 'Entities must be an array', value: entities })
      return
    }

    const ids = new Set<string>()
    entities.forEach((entity, index) => {
      if (!entity || typeof entity !== 'object') {
        errors.push({
          field: `entities[${index}]`,
          message: 'Entity must be an object',
          value: entity
        })
        return
      }

      const e = entity as Record<string, unknown>

      // Duplicate ID check
      if (typeof e.id === 'string') {
        if (ids.has(e.id)) {
          errors.push({
            field: `entities[${index}].id`,
            message: `Duplicate entity ID: ${e.id}`,
            value: e.id
          })
        }
        ids.add(e.id)
      } else {
        errors.push({
          field: `entities[${index}].id`,
          message: 'Entity ID must be a string',
          value: e.id
        })
      }

      if (!e.name || typeof e.name !== 'string') {
        errors.push({
          field: `entities[${index}].name`,
          message: 'Entity name is required and must be a string',
          value: e.name
        })
      }

      if (!(ENTITY_TYPES as readonly string[]).includes(e.type as string)) {
        errors.push({
          field: `entities[${index}].type`,
          message: `Entity type must be one of: ${ENTITY_TYPES.join(', ')}`,
          value: e.type
        })
      }

      this.validateTransform(e.transform, `entities[${index}].transform`, errors)

      if (typeof e.visible !== 'boolean') {
        errors.push({
          field: `entities[${index}].visible`,
          message: 'visible must be a boolean',
          value: e.visible
        })
      }

      if (typeof e.locked !== 'boolean') {
        errors.push({
          field: `entities[${index}].locked`,
          message: 'locked must be a boolean',
          value: e.locked
        })
      }

      // Properties validation (required by BaseEntity schema)
      if (
        !e.properties ||
        typeof e.properties !== 'object' ||
        e.properties === null ||
        Array.isArray(e.properties)
      ) {
        errors.push({
          field: `entities[${index}].properties`,
          message: 'properties is required and must be an object',
          value: e.properties
        })
      }

      // Type-specific validation
      this.validateEntityTypeFields(e, index, errors)

      // Extrusion validation (optional)
      if (e.extrusion !== undefined) {
        this.validateExtrusion(e.extrusion, `entities[${index}].extrusion`, errors)
      }
    })
  }

  private static validateEntityTypeFields(
    e: Record<string, unknown>,
    index: number,
    errors: ValidationError[]
  ): void {
    switch (e.type) {
      case 'circle':
        if (typeof e.diameter !== 'number' || (e.diameter as number) <= 0) {
          errors.push({
            field: `entities[${index}].diameter`,
            message: 'Circle diameter must be a number greater than 0',
            value: e.diameter
          })
        }
        break

      case 'rectangle':
        if (typeof e.width !== 'number' || (e.width as number) <= 0) {
          errors.push({
            field: `entities[${index}].width`,
            message: 'Rectangle width must be a number greater than 0',
            value: e.width
          })
        }
        if (typeof e.height !== 'number' || (e.height as number) <= 0) {
          errors.push({
            field: `entities[${index}].height`,
            message: 'Rectangle height must be a number greater than 0',
            value: e.height
          })
        }
        if (
          e.cornerRadius !== undefined &&
          (typeof e.cornerRadius !== 'number' || (e.cornerRadius as number) < 0)
        ) {
          errors.push({
            field: `entities[${index}].cornerRadius`,
            message: 'Corner radius must be a non-negative number',
            value: e.cornerRadius
          })
        }
        break

      case 'polygon':
        if (!Array.isArray(e.vertices)) {
          errors.push({
            field: `entities[${index}].vertices`,
            message: 'Polygon vertices must be an array',
            value: e.vertices
          })
        } else if ((e.vertices as unknown[]).length < 3) {
          errors.push({
            field: `entities[${index}].vertices`,
            message: 'Polygon must have at least 3 vertices',
            value: e.vertices
          })
        } else {
          ;(e.vertices as unknown[]).forEach((v, vi) => {
            if (!v || typeof v !== 'object') {
              errors.push({
                field: `entities[${index}].vertices[${vi}]`,
                message: 'Vertex must be an object with x, y',
                value: v
              })
            } else {
              const vtx = v as Record<string, unknown>
              if (typeof vtx.x !== 'number' || typeof vtx.y !== 'number') {
                errors.push({
                  field: `entities[${index}].vertices[${vi}]`,
                  message: 'Vertex x and y must be numbers',
                  value: v
                })
              }
            }
          })
        }
        break

      case 'svg-region':
        if (typeof e.pathData !== 'string' || (e.pathData as string).length === 0) {
          errors.push({
            field: `entities[${index}].pathData`,
            message: 'SVG region pathData must be a non-empty string',
            value: e.pathData
          })
        }
        break

      case 'mesh':
        if (typeof e.sourceFile !== 'string' || (e.sourceFile as string).length === 0) {
          errors.push({
            field: `entities[${index}].sourceFile`,
            message: 'Mesh sourceFile must be a non-empty string',
            value: e.sourceFile
          })
        }
        break
    }
  }

  private static validateExtrusion(
    extrusion: unknown,
    fieldPath: string,
    errors: ValidationError[]
  ): void {
    if (!extrusion || typeof extrusion !== 'object') {
      errors.push({ field: fieldPath, message: 'Extrusion must be an object', value: extrusion })
      return
    }

    const ext = extrusion as Record<string, unknown>

    if (typeof ext.depth !== 'number' || (ext.depth as number) <= 0) {
      errors.push({
        field: `${fieldPath}.depth`,
        message: 'Extrusion depth must be a number greater than 0',
        value: ext.depth
      })
    }

    if (!['up', 'down'].includes(ext.direction as string)) {
      errors.push({
        field: `${fieldPath}.direction`,
        message: "Extrusion direction must be 'up' or 'down'",
        value: ext.direction
      })
    }

    if (!['solid', 'cutter'].includes(ext.role as string)) {
      errors.push({
        field: `${fieldPath}.role`,
        message: "Extrusion role must be 'solid' or 'cutter'",
        value: ext.role
      })
    }
  }

  private static validateTransform(
    transform: unknown,
    fieldPath: string,
    errors: ValidationError[]
  ): void {
    if (!transform || typeof transform !== 'object') {
      errors.push({ field: fieldPath, message: 'Transform must be an object', value: transform })
      return
    }

    const t = transform as Record<string, unknown>
    for (const component of ['position', 'rotation', 'scale']) {
      this.validateVector3(t[component], `${fieldPath}.${component}`, errors)
    }
  }

  private static validateVector3(
    vector: unknown,
    fieldPath: string,
    errors: ValidationError[]
  ): void {
    if (!vector || typeof vector !== 'object') {
      errors.push({
        field: fieldPath,
        message: 'Vector must be an object with x, y, z properties',
        value: vector
      })
      return
    }

    const v = vector as Record<string, unknown>
    for (const axis of ['x', 'y', 'z']) {
      if (typeof v[axis] !== 'number') {
        errors.push({
          field: `${fieldPath}.${axis}`,
          message: `${axis} must be a number`,
          value: v[axis]
        })
      }
    }
  }

  private static validateGroups(
    groups: unknown,
    _entities: unknown[] | undefined,
    errors: ValidationError[]
  ): void {
    if (!Array.isArray(groups)) {
      errors.push({ field: 'groups', message: 'Groups must be an array', value: groups })
      return
    }

    const ids = new Set<string>()
    groups.forEach((group, index) => {
      if (!group || typeof group !== 'object') {
        errors.push({ field: `groups[${index}]`, message: 'Group must be an object', value: group })
        return
      }

      const g = group as Record<string, unknown>

      if (typeof g.id === 'string') {
        if (ids.has(g.id)) {
          errors.push({
            field: `groups[${index}].id`,
            message: `Duplicate group ID: ${g.id}`,
            value: g.id
          })
        }
        ids.add(g.id)
      } else {
        errors.push({
          field: `groups[${index}].id`,
          message: 'Group ID must be a string',
          value: g.id
        })
      }

      if (!Array.isArray(g.entityIds)) {
        errors.push({
          field: `groups[${index}].entityIds`,
          message: 'entityIds must be an array',
          value: g.entityIds
        })
      }
    })
  }

  private static validateGenerators(generators: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(generators)) {
      errors.push({
        field: 'generators',
        message: 'Generators must be an array',
        value: generators
      })
      return
    }

    const validTypes = ['grid', 'pattern', 'array', 'custom', 'linear-pattern']
    const ids = new Set<string>()
    generators.forEach((generator, index) => {
      if (!generator || typeof generator !== 'object') {
        errors.push({
          field: `generators[${index}]`,
          message: 'Generator must be an object',
          value: generator
        })
        return
      }

      const g = generator as Record<string, unknown>

      if (typeof g.id === 'string') {
        if (ids.has(g.id)) {
          errors.push({
            field: `generators[${index}].id`,
            message: `Duplicate generator ID: ${g.id}`,
            value: g.id
          })
        }
        ids.add(g.id)
      } else {
        errors.push({
          field: `generators[${index}].id`,
          message: 'Generator ID must be a string',
          value: g.id
        })
      }

      if (!validTypes.includes(g.type as string)) {
        errors.push({
          field: `generators[${index}].type`,
          message: `Generator type must be one of: ${validTypes.join(', ')}`,
          value: g.type
        })
      }

      // Validate config exists
      if (!g.config || typeof g.config !== 'object') {
        errors.push({
          field: `generators[${index}].config`,
          message: 'Generator config is required and must be an object',
          value: g.config
        })
      } else if (g.type === 'linear-pattern') {
        this.validateLinearPatternConfig(g.config, `generators[${index}].config`, errors)
      }
    })
  }

  private static validateLinearPatternConfig(
    config: unknown,
    fieldPath: string,
    errors: ValidationError[]
  ): void {
    if (!config || typeof config !== 'object') {
      errors.push({ field: fieldPath, message: 'Pattern config must be an object', value: config })
      return
    }

    const c = config as Record<string, unknown>

    if (!['x', 'y'].includes(c.axis as string)) {
      errors.push({ field: `${fieldPath}.axis`, message: "Axis must be 'x' or 'y'", value: c.axis })
    }

    if (typeof c.count !== 'number' || (c.count as number) < 1) {
      errors.push({
        field: `${fieldPath}.count`,
        message: 'Count must be a number >= 1',
        value: c.count
      })
    }

    const validModes = ['constant-pitch', 'size-aware', 'explicit']
    if (!validModes.includes(c.spacingMode as string)) {
      errors.push({
        field: `${fieldPath}.spacingMode`,
        message: `Spacing mode must be one of: ${validModes.join(', ')}`,
        value: c.spacingMode
      })
    }

    if (c.spacingMode === 'constant-pitch') {
      if (typeof c.constantPitch !== 'number' || (c.constantPitch as number) <= 0) {
        errors.push({
          field: `${fieldPath}.constantPitch`,
          message: 'Constant pitch must be a number greater than 0',
          value: c.constantPitch
        })
      }
    }

    if (c.spacingMode === 'explicit') {
      if (!Array.isArray(c.positions)) {
        errors.push({
          field: `${fieldPath}.positions`,
          message: 'Explicit positions must be an array',
          value: c.positions
        })
      } else if (typeof c.count === 'number' && (c.positions as unknown[]).length !== c.count) {
        errors.push({
          field: `${fieldPath}.positions`,
          message: `Positions array length (${(c.positions as unknown[]).length}) must equal count (${c.count})`,
          value: c.positions
        })
      }
    }
  }

  private static validateBins(
    bins: unknown,
    entities: unknown[] | undefined,
    errors: ValidationError[]
  ): void {
    if (!Array.isArray(bins)) {
      errors.push({ field: 'bins', message: 'Bins must be an array', value: bins })
      return
    }

    const entityIds = new Set(
      Array.isArray(entities)
        ? (entities as Array<Record<string, unknown>>)
            .filter((e) => e && typeof e.id === 'string')
            .map((e) => e.id as string)
        : []
    )

    const ids = new Set<string>()
    bins.forEach((bin, index) => {
      if (!bin || typeof bin !== 'object') {
        errors.push({ field: `bins[${index}]`, message: 'Bin must be an object', value: bin })
        return
      }

      const b = bin as Record<string, unknown>

      if (typeof b.id === 'string') {
        if (ids.has(b.id)) {
          errors.push({
            field: `bins[${index}].id`,
            message: `Duplicate bin ID: ${b.id}`,
            value: b.id
          })
        }
        ids.add(b.id)
      } else {
        errors.push({ field: `bins[${index}].id`, message: 'Bin ID must be a string', value: b.id })
      }

      const dimensions = ['width', 'depth', 'height']
      for (const dim of dimensions) {
        if (typeof b[dim] !== 'number' || (b[dim] as number) < 1) {
          errors.push({
            field: `bins[${index}].${dim}`,
            message: `${dim} must be a number >= 1`,
            value: b[dim]
          })
        }
      }

      // Validate entityIds (new field)
      if (b.entityIds !== undefined) {
        if (!Array.isArray(b.entityIds)) {
          errors.push({
            field: `bins[${index}].entityIds`,
            message: 'entityIds must be an array',
            value: b.entityIds
          })
        } else {
          ;(b.entityIds as unknown[]).forEach((eid, ei) => {
            if (typeof eid !== 'string') {
              errors.push({
                field: `bins[${index}].entityIds[${ei}]`,
                message: 'Entity ID must be a string',
                value: eid
              })
            } else if (entityIds.size > 0 && !entityIds.has(eid)) {
              errors.push({
                field: `bins[${index}].entityIds[${ei}]`,
                message: `Entity ID '${eid}' does not exist`,
                value: eid
              })
            }
          })
        }
      }
    })
  }
}

export function validateProject(data: unknown): ValidationResult {
  return ProjectValidator.validate(data)
}

export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return ''

  const lines = ['Project validation failed:']
  for (const error of errors) {
    lines.push(`  \u2022 ${error.field}: ${error.message}`)
    if (error.value !== undefined) {
      lines.push(`    Got: ${JSON.stringify(error.value)}`)
    }
  }

  return lines.join('\n')
}
