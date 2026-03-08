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
 * Migrate a v0.3.0/v0.4.0 project to v0.5.0:
 * - Convert entities[] to layoutSnapshot.shapes[]
 * - Convert bins[] to layoutSnapshot.groups[]
 * - layoutSnapshot becomes the canonical 2D layout data
 * - entities/bins arrays are preserved for backward compat but no longer authoritative
 */
function migrateV040toV050(project: RawProject): MigrationResult {
  const warnings: string[] = []

  // If layoutSnapshot already exists and has shapes, keep it
  const existingSnapshot = project.layoutSnapshot as RawProject | undefined
  if (existingSnapshot?.shapes && Array.isArray(existingSnapshot.shapes)) {
    const shapes = existingSnapshot.shapes as unknown[]
    if (shapes.length > 0) {
      return {
        project: { ...project, schemaVersion: '0.5.0' },
        warnings: ['Project already has layoutSnapshot — preserved existing data']
      }
    }
  }

  const entities = (project.entities ?? []) as RawEntity[]
  const bins = (project.bins ?? []) as RawBin[]
  const gridfinity = (project.gridfinity ?? {}) as Record<string, unknown>
  const baseUnit = (gridfinity.baseUnit as number) ?? 42

  // Convert entities to layout shapes
  const shapes: Record<string, unknown>[] = []
  for (const entity of entities) {
    const transform = (entity.transform ?? {}) as Record<string, unknown>
    const pos = (transform.position ?? {}) as Record<string, unknown>
    const x = (pos.x as number) ?? 0
    const y = (pos.y as number) ?? 0
    const rotation = ((transform.rotation as Record<string, unknown>)?.z as number) ?? 0

    const base = {
      id: entity.id as string,
      x,
      y,
      rotation,
      fill: 'rgba(96, 165, 250, 0.15)',
      stroke: '#60a5fa',
      strokeWidth: 1,
      groupId: (entity.groupId as string) ?? null,
      metadata: {
        name: entity.name,
        pocket: entity.pocket,
        ...(entity.properties as Record<string, unknown>)
      }
    }

    const type = entity.type as string
    switch (type) {
      case 'circle':
        shapes.push({
          ...base,
          type: 'circle',
          radiusX: ((entity.diameter as number) ?? 20) / 2,
          radiusY: ((entity.diameter as number) ?? 20) / 2
        })
        break
      case 'rectangle':
        shapes.push({
          ...base,
          type: 'rect',
          width: (entity.width as number) ?? 42,
          height: (entity.height as number) ?? 42,
          cornerRadius: (entity.cornerRadius as number) ?? 0
        })
        break
      case 'polygon':
        shapes.push({
          ...base,
          type: 'polygon',
          points: (entity.vertices as { x: number; y: number }[]) ?? []
        })
        break
      case 'svg-region':
        shapes.push({
          ...base,
          type: 'svgPath',
          pathData: (entity.pathData as string) ?? ''
        })
        break
      case 'mesh':
        shapes.push({
          ...base,
          type: 'meshImport',
          meshRef: (entity.sourceFile as string) ?? ''
        })
        break
      default:
        // Legacy entity types (bin, divider, label, custom) — convert to rect placeholder
        shapes.push({
          ...base,
          type: 'rect',
          width: 42,
          height: 42
        })
        warnings.push(
          `Entity "${entity.name ?? entity.id}": legacy type "${type}" converted to rect`
        )
        break
    }
  }

  // Convert bins to layout groups
  const groups: Record<string, unknown>[] = []
  for (const bin of bins) {
    const binW = (bin.width as number) ?? 1
    const binD = (bin.depth as number) ?? 1
    const binPos = (bin.position ?? {}) as Record<string, unknown>

    groups.push({
      id: bin.id as string,
      x: ((binPos.x as number) ?? 0) + (binW * baseUnit) / 2,
      y: ((binPos.y as number) ?? 0) + (binD * baseUnit) / 2,
      width: binW * baseUnit,
      height: binD * baseUnit,
      rotation: 0,
      childIds: (bin.entityIds as string[]) ?? [],
      style: {
        fill: 'rgba(96, 165, 250, 0.05)',
        stroke: '#60a5fa',
        strokeWidth: 1,
        cornerRadius: 4
      },
      metadata: {
        widthUnits: binW,
        depthUnits: binD,
        heightUnits: (bin.height as number) ?? 4,
        hasLip: (bin.hasStackingLip as boolean) ?? true,
        name: bin.name
      }
    })
  }

  const layoutSnapshot = {
    version: '1.0.0',
    shapes,
    groups,
    gridConfig: { size: baseUnit, enabled: true, visible: true }
  }

  warnings.push(
    `Converted ${shapes.length} entities to layout shapes, ${groups.length} bins to layout groups`
  )

  return {
    project: { ...project, schemaVersion: '0.5.0', layoutSnapshot },
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

  // v0.1.0 / v0.2.0 → v0.3.0
  if (version === '0.1.0' || version === '0.2.0') {
    const result = migrateV020toV030(project)
    project = result.project
    allWarnings.push(...result.warnings)
  }

  // v0.3.0 / v0.4.0 → v0.5.0
  if (
    (project.schemaVersion as string) === '0.3.0' ||
    (project.schemaVersion as string) === '0.4.0'
  ) {
    const result = migrateV040toV050(project)
    project = result.project
    allWarnings.push(...result.warnings)
  }

  if (allWarnings.length > 0) {
    allWarnings.unshift(`Migrated project from v${version} to v${CURRENT_SCHEMA_VERSION}`)
  }

  return { project, warnings: allWarnings }
}
