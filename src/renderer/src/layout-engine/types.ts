// ─── Shape Types (discriminated union) ──────────────────────────────────────

export interface BaseShape {
  id: string
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
}

export interface RectShape extends BaseShape {
  type: 'rect'
  width: number
  height: number
  cornerRadius?: number
}

export interface CircleShape extends BaseShape {
  type: 'circle'
  radiusX: number
  radiusY: number
}

export interface PolygonShape extends BaseShape {
  type: 'polygon'
  points: { x: number; y: number }[]
}

export interface SvgPathShape extends BaseShape {
  type: 'svgPath'
  pathData: string
  viewBox?: { width: number; height: number }
}

export interface MeshImportShape extends BaseShape {
  type: 'meshImport'
  meshRef: string
  silhouettePath?: string
}

export type LayoutShape = RectShape | CircleShape | PolygonShape | SvgPathShape | MeshImportShape

// ─── Group ──────────────────────────────────────────────────────────────────

export interface GroupStyle {
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius?: number
}

export interface LayoutGroup {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  childIds: string[]
  style: GroupStyle
  metadata?: Record<string, unknown>
}

// ─── Bin Metadata (stored in LayoutGroup.metadata) ──────────────────────────

export interface BinMetadata extends Record<string, unknown> {
  widthUnits: number
  depthUnits: number
  heightUnits: number
  hasLip: boolean
  name?: string
}

/**
 * Type guard: checks if a group's metadata contains BinMetadata fields.
 */
export function isBinGroup(group: LayoutGroup): group is LayoutGroup & { metadata: BinMetadata } {
  const m = group.metadata as Record<string, unknown> | undefined
  return (
    m !== undefined &&
    typeof m.widthUnits === 'number' &&
    typeof m.depthUnits === 'number' &&
    typeof m.heightUnits === 'number' &&
    typeof m.hasLip === 'boolean'
  )
}

// ─── Grid ───────────────────────────────────────────────────────────────────

export interface GridConfig {
  size: number
  enabled: boolean
  visible: boolean
}

// ─── Viewport ───────────────────────────────────────────────────────────────

export interface ViewportState {
  panX: number
  panY: number
  zoom: number
}

// ─── Transient State (for engine switching) ─────────────────────────────────

export interface TransientState {
  selectedIds: string[]
  viewport: ViewportState
}

// ─── Snapshot (serialization) ───────────────────────────────────────────────

export interface LayoutSnapshot {
  version: string
  shapes: LayoutShape[]
  groups: LayoutGroup[]
  gridConfig: GridConfig
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type EngineEventMap = {
  selectionChanged: { ids: string[] }
  shapeMoved: { id: string; x: number; y: number }
  shapeResized: {
    id: string
    width?: number
    height?: number
    radiusX?: number
    radiusY?: number
  }
  shapeCreated: { shape: LayoutShape }
  shapeDeleted: { id: string }
  groupChanged: { groupId: string; childIds: string[] }
  groupMoved: { id: string; x: number; y: number }
  viewportChanged: { panX: number; panY: number; zoom: number }
}
