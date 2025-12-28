/**
 * Canonical Project Data Model (v0)
 * Single source of truth for Gridfinity Studio projects
 */

/**
 * Schema version for project file format
 */
export const CURRENT_SCHEMA_VERSION = '0.1.0'

/**
 * Global settings for the project
 */
export interface GlobalSettings {
  /**
   * Project name
   */
  name: string

  /**
   * Project description
   */
  description?: string

  /**
   * Project author
   */
  author?: string

  /**
   * Project creation date (ISO 8601)
   */
  createdAt: string

  /**
   * Last modified date (ISO 8601)
   */
  modifiedAt: string

  /**
   * Units used in the project (mm, cm, in)
   */
  units: 'mm' | 'cm' | 'in'
}

/**
 * Gridfinity-specific configuration
 */
export interface GridfinityConfig {
  /**
   * Base unit size (default: 42mm for standard Gridfinity)
   */
  baseUnit: number

  /**
   * Grid spacing
   */
  gridSpacing: number

  /**
   * Height of a single Gridfinity unit
   */
  unitHeight: number

  /**
   * Tolerance for fitting (in mm)
   */
  tolerance: number

  /**
   * Magnet holes configuration
   */
  magnetHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }

  /**
   * Screw holes configuration
   */
  screwHoles: {
    enabled: boolean
    diameter: number
    depth: number
  }
}

/**
 * 3D position
 */
export interface Position {
  x: number
  y: number
  z: number
}

/**
 * 3D rotation (in radians)
 */
export interface Rotation {
  x: number
  y: number
  z: number
}

/**
 * 3D scale
 */
export interface Scale {
  x: number
  y: number
  z: number
}

/**
 * Transform for 3D objects
 */
export interface Transform {
  position: Position
  rotation: Rotation
  scale: Scale
}

/**
 * Base entity in the scene
 */
export interface Entity {
  /**
   * Unique identifier for the entity
   */
  id: string

  /**
   * Entity name
   */
  name: string

  /**
   * Entity type
   */
  type: 'bin' | 'divider' | 'label' | 'custom'

  /**
   * Transform data
   */
  transform: Transform

  /**
   * Visibility flag
   */
  visible: boolean

  /**
   * Lock flag (prevents editing)
   */
  locked: boolean

  /**
   * Parent group ID (if part of a group)
   */
  groupId?: string

  /**
   * Custom properties
   */
  properties: Record<string, unknown>
}

/**
 * Group of entities
 */
export interface Group {
  /**
   * Unique identifier for the group
   */
  id: string

  /**
   * Group name
   */
  name: string

  /**
   * Entity IDs in this group
   */
  entityIds: string[]

  /**
   * Visibility flag
   */
  visible: boolean

  /**
   * Lock flag (prevents editing)
   */
  locked: boolean

  /**
   * Custom properties
   */
  properties: Record<string, unknown>
}

/**
 * Generator parameters for procedural content
 */
export interface Generator {
  /**
   * Unique identifier for the generator
   */
  id: string

  /**
   * Generator name
   */
  name: string

  /**
   * Generator type
   */
  type: 'grid' | 'pattern' | 'array' | 'custom'

  /**
   * Generator parameters
   */
  parameters: Record<string, unknown>

  /**
   * Target entity ID or template
   */
  target?: string

  /**
   * Is this generator enabled?
   */
  enabled: boolean
}

/**
 * Bin configuration (Gridfinity-specific)
 */
export interface Bin {
  /**
   * Unique identifier for the bin
   */
  id: string

  /**
   * Bin name
   */
  name: string

  /**
   * Width in Gridfinity units
   */
  width: number

  /**
   * Depth in Gridfinity units
   */
  depth: number

  /**
   * Height in Gridfinity units
   */
  height: number

  /**
   * Enable/disable dividers
   */
  hasDividers: boolean

  /**
   * Number of dividers (if enabled)
   */
  dividerCount?: number

  /**
   * Enable/disable label area
   */
  hasLabel: boolean

  /**
   * Label text (if enabled)
   */
  labelText?: string

  /**
   * Enable/disable stacking lip
   */
  hasStackingLip: boolean

  /**
   * Custom properties for advanced configurations
   */
  properties: Record<string, unknown>
}

/**
 * Complete project data structure
 */
export interface ProjectData {
  /**
   * Schema version for validation and migration
   */
  schemaVersion: string

  /**
   * Global project settings
   */
  settings: GlobalSettings

  /**
   * Gridfinity-specific configuration
   */
  gridfinity: GridfinityConfig

  /**
   * All entities in the project
   */
  entities: Entity[]

  /**
   * Groups of entities
   */
  groups: Group[]

  /**
   * Generators for procedural content
   */
  generators: Generator[]

  /**
   * Bin configurations
   */
  bins: Bin[]
}

/**
 * Default Gridfinity configuration
 */
export const DEFAULT_GRIDFINITY_CONFIG: GridfinityConfig = {
  baseUnit: 42,
  gridSpacing: 42,
  unitHeight: 7,
  tolerance: 0.5,
  magnetHoles: {
    enabled: true,
    diameter: 6.5,
    depth: 2.4
  },
  screwHoles: {
    enabled: false,
    diameter: 3,
    depth: 6
  }
}

/**
 * Create a new empty project with default values
 */
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
    gridfinity: DEFAULT_GRIDFINITY_CONFIG,
    entities: [],
    groups: [],
    generators: [],
    bins: []
  }
}

/**
 * Create a default transform
 */
export function createDefaultTransform(): Transform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  }
}
