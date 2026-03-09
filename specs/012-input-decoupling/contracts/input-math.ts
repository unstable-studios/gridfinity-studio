/**
 * Contract: Shared Input Math (Pure Functions)
 *
 * Engine-agnostic coordinate math extracted from both Fabric and
 * Konva engines. These are pure functions with no engine dependency.
 *
 * This is a DESIGN CONTRACT — not production code.
 */

// ─── Snap-to-Grid ────────────────────────────────────────────────────────────

interface SnapResult {
  x: number
  y: number
}

/**
 * Snap a lower-left corner position to the nearest grid intersection.
 *
 * Formula: round(value / gridSize) * gridSize
 *
 * Used for bin group positioning. Shapes do NOT snap.
 */
declare function snapLowerLeft(x: number, y: number, gridSize: number): SnapResult

// ─── Resize Quantization ─────────────────────────────────────────────────────

interface ResizeResult {
  width: number
  height: number
}

/**
 * Round dimensions to the nearest grid-aligned values.
 * Minimum 1 grid unit per dimension.
 *
 * Formula: max(gridSize, round(value / gridSize) * gridSize)
 */
declare function quantizeResize(width: number, height: number, gridSize: number): ResizeResult

// ─── Edge-Anchor Computation ─────────────────────────────────────────────────

interface Bounds {
  /** Lower-left x */
  x: number
  /** Lower-left y (largest y in screen coords) */
  y: number
  width: number
  height: number
}

interface AnchoredResizeResult {
  /** New lower-left x */
  x: number
  /** New lower-left y */
  y: number
  /** Grid-snapped width */
  width: number
  /** Grid-snapped height */
  height: number
}

/**
 * Given original bounds, scale factors, and the current visual centroid
 * (from the engine's object position during resize), compute the new
 * position and dimensions with edge anchoring and grid quantization.
 *
 * Edge anchoring: detect which edges are stationary by comparing
 * the visual bounds (scaled from centroid) against the original bounds.
 * The edge closest to its original position is the anchor; the opposite
 * edge moves to accommodate the new size.
 *
 * The centroid must come from the engine (Fabric: obj.left/top,
 * Konva: group.x()/y()) — during resize the engine shifts it toward
 * the dragged edge, making anchor detection work correctly.
 *
 * Used by both Fabric and Konva resize handlers (currently ~40 lines
 * duplicated in each).
 */
declare function computeEdgeAnchor(
  original: Bounds,
  scaleX: number,
  scaleY: number,
  centroidX: number,
  centroidY: number,
  gridSize: number
): AnchoredResizeResult

export type { SnapResult, ResizeResult, Bounds, AnchoredResizeResult }
export { snapLowerLeft, quantizeResize, computeEdgeAnchor }
