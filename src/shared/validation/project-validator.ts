import type { ProjectData } from '../types/project'
import { CURRENT_SCHEMA_VERSION } from '../types/project'

/**
 * Validation error details
 */
export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Simple JSON Schema validator implementation
 * This is a basic implementation - in production, consider using ajv or similar
 */
export class ProjectValidator {
  /**
   * Validate project data against the schema
   */
  static validate(data: unknown): ValidationResult {
    const errors: ValidationError[] = []

    // Check if data is an object
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: [{ field: 'root', message: 'Project data must be an object' }]
      }
    }

    const project = data as Partial<ProjectData>

    // Validate required top-level fields
    this.validateRequired(project, errors)

    // Validate schema version
    this.validateSchemaVersion(project, errors)

    // Validate settings
    if (project.settings) {
      this.validateSettings(project.settings, errors)
    }

    // Validate gridfinity config
    if (project.gridfinity) {
      this.validateGridfinity(project.gridfinity, errors)
    }

    // Validate arrays
    if (project.entities) {
      this.validateEntities(project.entities, errors)
    }

    if (project.groups) {
      this.validateGroups(project.groups, errors)
    }

    if (project.generators) {
      this.validateGenerators(project.generators, errors)
    }

    if (project.bins) {
      this.validateBins(project.bins, errors)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate required fields
   */
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
        errors.push({
          field,
          message: `Missing required field: ${field}`
        })
      }
    }
  }

  /**
   * Validate schema version
   */
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

    // Check version format (semver)
    const versionRegex = /^\d+\.\d+\.\d+$/
    if (!versionRegex.test(project.schemaVersion)) {
      errors.push({
        field: 'schemaVersion',
        message: 'Schema version must follow semver format (e.g., "0.1.0")',
        value: project.schemaVersion
      })
    }

    // Warn if version doesn't match current version
    if (project.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // This is a warning, not an error - allow loading older versions
      console.warn(
        `Project schema version (${project.schemaVersion}) differs from current version (${CURRENT_SCHEMA_VERSION}). Migration may be needed.`
      )
    }
  }

  /**
   * Validate settings
   */
  private static validateSettings(settings: unknown, errors: ValidationError[]): void {
    if (typeof settings !== 'object' || !settings) {
      errors.push({
        field: 'settings',
        message: 'Settings must be an object',
        value: settings
      })
      return
    }

    const s = settings as Record<string, unknown>

    // Validate required fields
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

  /**
   * Validate gridfinity config
   */
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

    // Validate numeric fields
    const numericFields = ['baseUnit', 'gridSpacing', 'unitHeight', 'tolerance']
    for (const field of numericFields) {
      if (typeof c[field] !== 'number') {
        errors.push({
          field: `gridfinity.${field}`,
          message: `${field} must be a number`,
          value: c[field]
        })
      } else if (c[field] as number <= 0 && field !== 'tolerance') {
        errors.push({
          field: `gridfinity.${field}`,
          message: `${field} must be greater than 0`,
          value: c[field]
        })
      }
    }

    // Validate holes configurations
    this.validateHolesConfig(c.magnetHoles, 'magnetHoles', errors)
    this.validateHolesConfig(c.screwHoles, 'screwHoles', errors)
  }

  /**
   * Validate holes configuration
   */
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

  /**
   * Validate entities array
   */
  private static validateEntities(entities: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(entities)) {
      errors.push({
        field: 'entities',
        message: 'Entities must be an array',
        value: entities
      })
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

      // Check for duplicate IDs
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

      // Validate required fields
      if (!e.name || typeof e.name !== 'string') {
        errors.push({
          field: `entities[${index}].name`,
          message: 'Entity name is required and must be a string',
          value: e.name
        })
      }

      if (!['bin', 'divider', 'label', 'custom'].includes(e.type as string)) {
        errors.push({
          field: `entities[${index}].type`,
          message: 'Entity type must be one of: bin, divider, label, custom',
          value: e.type
        })
      }

      // Validate transform
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

      if (!e.properties || typeof e.properties !== 'object') {
        errors.push({
          field: `entities[${index}].properties`,
          message: 'properties must be an object',
          value: e.properties
        })
      }
    })
  }

  /**
   * Validate transform
   */
  private static validateTransform(
    transform: unknown,
    fieldPath: string,
    errors: ValidationError[]
  ): void {
    if (!transform || typeof transform !== 'object') {
      errors.push({
        field: fieldPath,
        message: 'Transform must be an object',
        value: transform
      })
      return
    }

    const t = transform as Record<string, unknown>

    // Validate position, rotation, scale
    const components = ['position', 'rotation', 'scale']
    for (const component of components) {
      this.validateVector3(t[component], `${fieldPath}.${component}`, errors)
    }
  }

  /**
   * Validate 3D vector
   */
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

  /**
   * Validate groups array
   */
  private static validateGroups(groups: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(groups)) {
      errors.push({
        field: 'groups',
        message: 'Groups must be an array',
        value: groups
      })
      return
    }

    const ids = new Set<string>()
    groups.forEach((group, index) => {
      if (!group || typeof group !== 'object') {
        errors.push({
          field: `groups[${index}]`,
          message: 'Group must be an object',
          value: group
        })
        return
      }

      const g = group as Record<string, unknown>

      // Check for duplicate IDs
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

  /**
   * Validate generators array
   */
  private static validateGenerators(generators: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(generators)) {
      errors.push({
        field: 'generators',
        message: 'Generators must be an array',
        value: generators
      })
      return
    }

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

      // Check for duplicate IDs
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

      if (!['grid', 'pattern', 'array', 'custom'].includes(g.type as string)) {
        errors.push({
          field: `generators[${index}].type`,
          message: 'Generator type must be one of: grid, pattern, array, custom',
          value: g.type
        })
      }
    })
  }

  /**
   * Validate bins array
   */
  private static validateBins(bins: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(bins)) {
      errors.push({
        field: 'bins',
        message: 'Bins must be an array',
        value: bins
      })
      return
    }

    const ids = new Set<string>()
    bins.forEach((bin, index) => {
      if (!bin || typeof bin !== 'object') {
        errors.push({
          field: `bins[${index}]`,
          message: 'Bin must be an object',
          value: bin
        })
        return
      }

      const b = bin as Record<string, unknown>

      // Check for duplicate IDs
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
        errors.push({
          field: `bins[${index}].id`,
          message: 'Bin ID must be a string',
          value: b.id
        })
      }

      // Validate dimensions
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
    })
  }
}

/**
 * Convenience function to validate project data
 */
export function validateProject(data: unknown): ValidationResult {
  return ProjectValidator.validate(data)
}

/**
 * Format validation errors into a human-readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return ''

  const lines = ['Project validation failed:']
  for (const error of errors) {
    lines.push(`  • ${error.field}: ${error.message}`)
    if (error.value !== undefined) {
      lines.push(`    Got: ${JSON.stringify(error.value)}`)
    }
  }

  return lines.join('\n')
}
