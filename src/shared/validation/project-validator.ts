import type { ProjectData } from '../types/project'
import { SUPPORTED_SCHEMA_VERSIONS, CURRENT_SCHEMA_VERSION } from '../types/project'

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

    return { valid: errors.length === 0, errors }
  }

  private static validateRequired(project: Partial<ProjectData>, errors: ValidationError[]): void {
    const required = ['schemaVersion', 'settings', 'gridfinity', 'layoutSnapshot']

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
}

export function validateProject(data: unknown): ValidationResult {
  return ProjectValidator.validate(data)
}

/**
 * Migrate a loaded project to the current schema version.
 * Old entity/bin data is handled by migrations.ts (which converts to layoutSnapshot).
 * This function handles any remaining fixups on the canonical ProjectData shape.
 */
export function migrateProject(project: ProjectData): ProjectData {
  if (project.schemaVersion === CURRENT_SCHEMA_VERSION) return project
  return { ...project, schemaVersion: CURRENT_SCHEMA_VERSION }
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
