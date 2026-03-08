/**
 * Canonical Project Data Model (v0.3.0)
 * Single source of truth for Gridfinity Studio projects
 */

/**
 * Schema version for project file format
 */
export const CURRENT_SCHEMA_VERSION = '0.5.0'

/**
 * Supported schema versions for backward compatibility
 */
export const SUPPORTED_SCHEMA_VERSIONS = ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0']

/**
 * Global settings for the project
 */
export interface GlobalSettings {
  name: string
  description?: string
  author?: string
  createdAt: string
  modifiedAt: string
  units: 'mm' | 'cm' | 'in'
}

/**
 * Gridfinity-specific configuration
 */
export interface GridfinityConfig {
  baseUnit: number
  gridSpacing: number
  unitHeight: number
  tolerance: number
  magnetHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }
  screwHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }
}

/**
 * Named tolerance presets for different printer/fit requirements
 */
export type TolerancePreset = 'standard' | 'loose' | 'tight'

export const TOLERANCE_PRESETS: Record<TolerancePreset, number> = {
  standard: 0.5,
  loose: 0.6,
  tight: 0.3
}

export const GRIDFINITY_PRESETS: Record<TolerancePreset, GridfinityConfig> = {
  standard: {
    baseUnit: 42,
    gridSpacing: 42,
    unitHeight: 7,
    tolerance: 0.5,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  },
  loose: {
    baseUnit: 42,
    gridSpacing: 42,
    unitHeight: 7,
    tolerance: 0.6,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  },
  tight: {
    baseUnit: 42,
    gridSpacing: 42,
    unitHeight: 7,
    tolerance: 0.3,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  }
}

// ─── Geometric primitives ──────────────────────────────────────────

export interface Position {
  x: number
  y: number
  z: number
}

export interface Rotation {
  x: number
  y: number
  z: number
}

export interface Scale {
  x: number
  y: number
  z: number
}

export interface Transform {
  position: Position
  rotation: Rotation
  scale: Scale
}

export interface Vertex2D {
  x: number
  y: number
}

// ─── Pocket ───────────────────────────────────────────────────────

export interface PocketConfig {
  depth: number
  clearance: number
}

// ─── Extrusion (legacy, kept for migration) ───────────────────────

export interface ExtrusionConfig {
  depth: number
  direction: 'up' | 'down'
  role: 'solid' | 'cutter'
}

// ─── Entity types (discriminated union) ────────────────────────────

interface BaseEntity {
  id: string
  name: string
  transform: Transform
  visible: boolean
  locked: boolean
  groupId?: string
  pocket?: PocketConfig
  properties: Record<string, unknown>
}

export interface LegacyEntity extends BaseEntity {
  type: 'bin' | 'divider' | 'label' | 'custom'
}

export interface CircleEntity extends BaseEntity {
  type: 'circle'
  diameter: number
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle'
  width: number
  height: number
  cornerRadius?: number
}

export interface PolygonEntity extends BaseEntity {
  type: 'polygon'
  vertices: Vertex2D[]
}

export interface SvgRegionEntity extends BaseEntity {
  type: 'svg-region'
  pathData: string
  sourceFile?: string
}

export interface MeshEntity extends BaseEntity {
  type: 'mesh'
  sourceFile: string
}

export type Entity =
  | LegacyEntity
  | CircleEntity
  | RectangleEntity
  | PolygonEntity
  | SvgRegionEntity
  | MeshEntity

export type EntityType = Entity['type']

export const ENTITY_TYPES: EntityType[] = [
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

// ─── Groups ────────────────────────────────────────────────────────

export interface Group {
  id: string
  name: string
  entityIds: string[]
  visible: boolean
  locked: boolean
  properties: Record<string, unknown>
}

// ─── Generators (pattern system) ───────────────────────────────────

export type SpacingMode = 'constant-pitch' | 'size-aware' | 'explicit'

export interface LinearPatternConfig {
  axis: 'x' | 'y'
  count: number
  spacingMode: SpacingMode
  constantPitch?: number
  gap?: number
  positions?: number[]
}

export type GeneratorConfig = LinearPatternConfig | Record<string, unknown>

export interface Generator {
  id: string
  name: string
  type: 'grid' | 'pattern' | 'array' | 'custom' | 'linear-pattern'
  config: GeneratorConfig
  sourceEntityId?: string
  enabled: boolean
}

// ─── Bins ──────────────────────────────────────────────────────────

export interface Bin {
  id: string
  name: string
  width: number
  depth: number
  height: number
  position: { x: number; y: number }
  hasDividers: boolean
  dividerCount?: number
  hasLabel: boolean
  labelText?: string
  hasStackingLip: boolean
  entityIds: string[]
  properties: Record<string, unknown>
}

// ─── Layout Snapshot (engine-agnostic 2D canvas state) ────────────

/**
 * Typed layout snapshot for project persistence.
 * Shape and group types mirror the engine's LayoutShape/LayoutGroup interfaces
 * but are defined here in shared/ so they're available to all processes.
 */
export interface LayoutShapeData {
  id: string
  type: 'rect' | 'circle' | 'polygon' | 'svgPath' | 'meshImport'
  x: number
  y: number
  rotation: number
  fill: string
  stroke: string
  strokeWidth: number
  groupId: string | null
  scaleX?: number
  scaleY?: number
  lockAspectRatio?: boolean
  metadata?: Record<string, unknown>
  // Type-specific fields (present depending on type)
  width?: number
  height?: number
  cornerRadius?: number
  radiusX?: number
  radiusY?: number
  points?: { x: number; y: number }[]
  pathData?: string
  viewBox?: { width: number; height: number }
  meshRef?: string
  silhouettePath?: string
}

export interface LayoutGroupData {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  childIds: string[]
  style: {
    fill: string
    stroke: string
    strokeWidth: number
    cornerRadius?: number
  }
  metadata?: Record<string, unknown>
}

export interface LayoutSnapshotData {
  version: string
  shapes: LayoutShapeData[]
  groups: LayoutGroupData[]
  gridConfig: {
    size: number
    enabled: boolean
    visible: boolean
  }
}

// ─── Project ───────────────────────────────────────────────────────

export interface ProjectData {
  schemaVersion: string
  settings: GlobalSettings
  gridfinity: GridfinityConfig
  entities: Entity[]
  groups: Group[]
  generators: Generator[]
  bins: Bin[]
  layoutSnapshot: LayoutSnapshotData
}

// ─── Defaults & factories ──────────────────────────────────────────

/** Base profile height from Gridfinity spec (mm) */
const BASE_PROFILE_HEIGHT = 4.95
/** Internal floor thickness (mm) */
const FLOOR_THICKNESS = 1.0

/**
 * Compute the default pocket depth for a bin: the full interior cavity height.
 * totalH = heightUnits * unitHeight, interior = totalH - floor - baseProfile
 */
export function computeDefaultPocketDepth(heightUnits: number, unitHeight: number): number {
  const totalH = heightUnits * unitHeight
  const depth = totalH - FLOOR_THICKNESS - BASE_PROFILE_HEIGHT
  return Math.max(0.1, Math.round(depth * 10) / 10)
}

export const DEFAULT_GRIDFINITY_CONFIG: GridfinityConfig = GRIDFINITY_PRESETS.standard

export function createEmptyProject(name: string = 'Untitled Project'): ProjectData {
  const now = new Date().toISOString()

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      name,
      description: '',
      author: '',
      createdAt: now,
      modifiedAt: now,
      units: 'mm'
    },
    gridfinity: { ...DEFAULT_GRIDFINITY_CONFIG },
    entities: [],
    groups: [],
    generators: [],
    bins: [],
    layoutSnapshot: {
      version: '1.0.0',
      shapes: [],
      groups: [],
      gridConfig: { size: 42, enabled: true, visible: true }
    }
  }
}

export function createDefaultTransform(): Transform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  }
}
