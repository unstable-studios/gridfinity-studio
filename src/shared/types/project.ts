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

// ─── Pocket ───────────────────────────────────────────────────────

export interface PocketConfig {
  depth: number
  clearance: number
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

/**
 * Map a pocket's depth (mm) to a render-time opacity in [0.5, 1.0].
 *
 *   depth ≈ 0    → 0.50 (very faint)
 *   depth = max  → 1.00 (full)
 *
 * `null`/`undefined` (auto) returns 1.0 — the default IS the max safe depth,
 * so visually the shape sits at the deeper end of the spectrum.
 *
 * Used by the layout engine's shape renderers to give an at-a-glance
 * visual cue for relative pocket depths.
 */
export function depthToOpacity(
  depth: number | null | undefined,
  heightUnits: number,
  unitHeight: number
): number {
  if (depth === null || depth === undefined) return 1
  const max = computeDefaultPocketDepth(heightUnits, unitHeight)
  if (max <= 0) return 1
  const ratio = Math.max(0, Math.min(1, depth / max))
  return 0.5 + 0.5 * ratio
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
    layoutSnapshot: {
      version: '1.0.0',
      shapes: [],
      groups: [],
      gridConfig: { size: 42, enabled: true, visible: true }
    }
  }
}
