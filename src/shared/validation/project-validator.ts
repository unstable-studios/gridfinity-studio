import type { LayoutSnapshotData, ProjectData } from '../types/project'
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

    // A field that is present is checked even when it holds nothing: `null` is not settings.
    if ('settings' in project) this.validateSettings(project.settings, errors)
    if ('gridfinity' in project) this.validateGridfinity(project.gridfinity, errors)
    if ('layoutSnapshot' in project) validateLayout(project.layoutSnapshot, errors)

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

// ─── Layout ─────────────────────────────────────────────────────────

/** At most this many problems are reported for a layout. A broken file can have thousands. */
const MAX_LAYOUT_ERRORS = 20

/** The fields each kind of shape must have, beyond the ones every shape has. */
const SHAPE_FIELDS: Record<string, { numbers?: string[]; text?: string[] }> = {
  rect: { numbers: ['width', 'height'] },
  circle: { numbers: ['radiusX', 'radiusY'] },
  polygon: {},
  svgPath: { text: ['pathData'] },
  meshImport: { text: ['meshRef'] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A number that can be drawn and cut: not NaN, and not infinite. */
function isLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Check the layout: the bins, the shapes, and that they point at each other.
 *
 * This is what the canvas and the 3D model rely on. It does not check that bins and shapes
 * agree about which shape is in which bin: `repairLayout` puts that right when a file is
 * opened, so drift never stops a project from being saved or opened.
 */
function validateLayout(layout: unknown, all: ValidationError[]): void {
  const errors: ValidationError[] = []
  const add = (field: string, message: string, value?: unknown): void => {
    // A whole list or shape is no help in a message, and can be very large.
    const short =
      value === null || ['number', 'boolean'].includes(typeof value)
        ? value
        : typeof value === 'string'
          ? value.slice(0, 60)
          : undefined
    errors.push({
      field: `layoutSnapshot.${field}`,
      message,
      ...(short !== undefined && { value: short })
    })
  }

  if (!isRecord(layout)) {
    all.push({ field: 'layoutSnapshot', message: 'Layout must be an object', value: layout })
    return
  }
  if (typeof layout.version !== 'string') add('version', 'version must be text', layout.version)

  const grid = layout.gridConfig
  if (!isRecord(grid)) {
    add('gridConfig', 'gridConfig must be an object', grid)
  } else {
    if (!isLength(grid.size) || grid.size <= 0) {
      add('gridConfig.size', 'size must be a number greater than 0', grid.size)
    }
    for (const flag of ['enabled', 'visible']) {
      if (typeof grid[flag] !== 'boolean') {
        add(`gridConfig.${flag}`, `${flag} must be true or false`, grid[flag])
      }
    }
  }

  const shapes = Array.isArray(layout.shapes) ? layout.shapes : null
  const groups = Array.isArray(layout.groups) ? layout.groups : null
  if (!shapes) add('shapes', 'shapes must be a list', layout.shapes)
  if (!groups) add('groups', 'groups must be a list', layout.groups)

  // Bins and shapes share one set of ids: the canvas looks both up by id.
  const seen = new Set<string>()
  const checkId = (field: string, id: unknown): id is string => {
    if (typeof id !== 'string' || id === '') {
      add(`${field}.id`, 'id must be text and not empty', id)
      return false
    }
    if (seen.has(id)) add(`${field}.id`, `Duplicate id: ${id}`, id)
    seen.add(id)
    return true
  }
  const checkNumbers = (field: string, item: Record<string, unknown>, names: string[]): void => {
    for (const name of names) {
      if (!isLength(item[name])) add(`${field}.${name}`, `${name} must be a number`, item[name])
    }
  }

  groups?.forEach((group, i) => {
    const field = `groups[${i}]`
    if (!isRecord(group)) return add(field, 'A group must be an object', group)
    checkId(field, group.id)
    checkNumbers(field, group, ['x', 'y', 'width', 'height', 'rotation'])
    if (!Array.isArray(group.childIds) || group.childIds.some((id) => typeof id !== 'string')) {
      add(`${field}.childIds`, 'childIds must be a list of ids', group.childIds)
    }
    if (!isRecord(group.style)) add(`${field}.style`, 'style must be an object', group.style)
    if (group.metadata !== undefined && !isRecord(group.metadata)) {
      add(`${field}.metadata`, 'metadata must be an object', group.metadata)
    }
  })

  shapes?.forEach((shape, i) => {
    const field = `shapes[${i}]`
    if (!isRecord(shape)) return add(field, 'A shape must be an object', shape)
    checkId(field, shape.id)
    checkNumbers(field, shape, ['x', 'y', 'rotation', 'strokeWidth'])
    for (const name of ['fill', 'stroke']) {
      if (typeof shape[name] !== 'string')
        add(`${field}.${name}`, `${name} must be text`, shape[name])
    }
    if (shape.metadata !== undefined && !isRecord(shape.metadata)) {
      add(`${field}.metadata`, 'metadata must be an object', shape.metadata)
    }

    const fields = typeof shape.type === 'string' ? SHAPE_FIELDS[shape.type] : undefined
    if (!fields || !Object.hasOwn(SHAPE_FIELDS, shape.type as string)) {
      add(
        `${field}.type`,
        `type must be one of: ${Object.keys(SHAPE_FIELDS).join(', ')}`,
        shape.type
      )
    } else {
      checkNumbers(field, shape, fields.numbers ?? [])
      for (const name of fields.text ?? []) {
        if (typeof shape[name] !== 'string')
          add(`${field}.${name}`, `${name} must be text`, shape[name])
      }
      if (shape.type === 'polygon') {
        const points = shape.points
        const valid =
          Array.isArray(points) &&
          points.every((point) => isRecord(point) && isLength(point.x) && isLength(point.y))
        if (!valid) add(`${field}.points`, 'points must be a list of { x, y } numbers', points)
      }
    }

    // A `groupId` that names no bin is put right by `repairLayout`, like a drifted list.
    if (shape.groupId !== null && typeof shape.groupId !== 'string') {
      add(`${field}.groupId`, 'groupId must be an id or null', shape.groupId)
    }
  })

  const extra = errors.length - MAX_LAYOUT_ERRORS
  all.push(...errors.slice(0, MAX_LAYOUT_ERRORS))
  if (extra > 0) all.push({ field: 'layoutSnapshot', message: `and ${extra} more problems` })
}

/**
 * Put a layout's bins and shapes back in step. A shape's `groupId` is what the canvas goes
 * by, so drift is put right, not refused:
 * - A shape whose `groupId` names no bin is in no bin.
 * - Each bin's `childIds` lists the shapes that say they are in it. A bin keeps the order
 *   it had, with shapes it did not list added at the end.
 *
 * Returns the same layout when nothing needed repair.
 */
export function repairLayout(layout: LayoutSnapshotData): LayoutSnapshotData {
  const groupIds = new Set(layout.groups.map((group) => group.id))
  let changed = false
  const shapes = layout.shapes.map((shape) => {
    if (shape.groupId === null || groupIds.has(shape.groupId)) return shape
    changed = true
    return { ...shape, groupId: null }
  })

  const members = new Map<string, string[]>()
  for (const shape of shapes) {
    if (shape.groupId === null) continue
    members.set(shape.groupId, [...(members.get(shape.groupId) ?? []), shape.id])
  }
  const groups = layout.groups.map((group) => {
    const mine = members.get(group.id) ?? []
    const kept = group.childIds.filter((id, i, ids) => mine.includes(id) && ids.indexOf(id) === i)
    const childIds = [...kept, ...mine.filter((id) => !kept.includes(id))]
    const same =
      childIds.length === group.childIds.length &&
      childIds.every((id, i) => id === group.childIds[i])
    if (same) return group
    changed = true
    return { ...group, childIds }
  })
  return changed ? { ...layout, shapes, groups } : layout
}

export function validateProject(data: unknown): ValidationResult {
  return ProjectValidator.validate(data)
}

/**
 * Migrate a loaded project to the current schema version.
 * Old entity/bin data is handled by migrations.ts (which converts to layoutSnapshot).
 * This function handles any remaining fixups on the canonical ProjectData shape: the
 * version number, and bins' lists of their shapes.
 */
export function migrateProject(project: ProjectData): ProjectData {
  const layoutSnapshot = repairLayout(project.layoutSnapshot)
  if (
    project.schemaVersion === CURRENT_SCHEMA_VERSION &&
    layoutSnapshot === project.layoutSnapshot
  ) {
    return project
  }
  return { ...project, schemaVersion: CURRENT_SCHEMA_VERSION, layoutSnapshot }
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
