/**
 * Z-layer constants for canvas rendering order.
 * Higher values render on top and receive pointer events first.
 *
 * r3f's raycaster dispatches events to the nearest mesh by z-distance,
 * so explicit z-positions determine event priority.
 */
export const Z = {
  /** Background click-deselect and marquee start plane */
  BACKGROUND_PLANE: -0.01,
  /** Bin footprint fill (behind grid) */
  BIN_FILL: -0.005,
  /** Grid lines, tool capture planes */
  GRID: 0,
  /** Bin hit area for click/drag */
  BIN_HIT_AREA: 0.001,
  /** Bin drag/resize capture plane */
  BIN_CAPTURE_PLANE: 0.002,
  /** Keep-out overlay (magnet/screw holes, lip band) */
  KEEPOUT_OVERLAY: 0.005,
  /** Bin resize handle meshes */
  BIN_RESIZE_HANDLE: 0.007,
  /** Entity outline strokes */
  ENTITY_OUTLINE: 0.01,
  /** Entity fill meshes (hit areas) */
  ENTITY_FILL: 0.005,
  /** Tool preview shapes, grid overlay */
  TOOL_PREVIEW: 0.02,
  /** Tool close-snap indicator */
  TOOL_SNAP: 0.01,
  /** Marquee selection box visual */
  SELECTION_BOX: 0.03,
  /** Gizmo full-screen capture plane during drag/resize */
  GIZMO_CAPTURE_PLANE: 0.03,
  /** Gizmo invisible drag handle over selection */
  GIZMO_DRAG_HANDLE: 0.04,
  /** Gizmo cross indicator at centroid */
  GIZMO_CROSS: 0.05,
  /** Gizmo resize handle dots (topmost interactive) */
  GIZMO_RESIZE_HANDLE: 0.06,
  /** Gizmo resize handle hit area (just below visible) */
  GIZMO_RESIZE_HIT: 0.059
} as const
