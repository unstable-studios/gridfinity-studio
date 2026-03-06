/**
 * Schema migrations for .gfstudio project files.
 *
 * Each migration converts from one schema version to the next.
 */

import { CURRENT_SCHEMA_VERSION } from '../types/project'

type RawProject = Record<string, unknown>
type RawEntity = Record<string, unknown>
type RawBin = Record<string, unknown>

interface MigrationResult {
  project: RawProject
  warnings: string[]
}

/**
 * Migrate a v0.2.0 project to v0.3.0:
 * - Convert entity `extrusion` → `pocket` (depth carries over, clearance defaults to 0.2)
 * - Make bin `entityIds` required (default [])
 * - Bump schemaVersion
 */
function migrateV020toV030(project: RawProject): MigrationResult {
  const warnings: string[] = []

  const entities = (project.entities ?? []) as RawEntity[]
  for (const entity of entities) {
    if (entity.extrusion && typeof entity.extrusion === 'object') {
      const ext = entity.extrusion as Record<string, unknown>
      const depth = typeof ext.depth === 'number' && ext.depth > 0 ? ext.depth : 5
      entity.pocket = { depth, clearance: 0.2 }
      delete entity.extrusion
      warnings.push(
        `Entity "${entity.name ?? entity.id}": migrated extrusion → pocket (depth=${depth}, clearance=0.2)`
      )
    }
  }

  const bins = (project.bins ?? []) as RawBin[]
  for (const bin of bins) {
    if (!Array.isArray(bin.entityIds)) {
      bin.entityIds = []
    }
  }

  return {
    project: { ...project, schemaVersion: '0.3.0', entities, bins },
    warnings
  }
}

/**
 * Apply all necessary migrations to bring a project up to the current schema version.
 * Returns the migrated project and any warnings generated during migration.
 */
export function migrateProject(raw: RawProject): MigrationResult {
  const allWarnings: string[] = []
  let project = { ...raw }
  const version = project.schemaVersion as string

  if (version === CURRENT_SCHEMA_VERSION) {
    return { project, warnings: [] }
  }

  if (version === '0.1.0' || version === '0.2.0') {
    const result = migrateV020toV030(project)
    project = result.project
    allWarnings.push(...result.warnings)
  }

  if (allWarnings.length > 0) {
    allWarnings.unshift(`Migrated project from v${version} to v${CURRENT_SCHEMA_VERSION}`)
  }

  return { project, warnings: allWarnings }
}
