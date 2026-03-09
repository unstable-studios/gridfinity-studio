/**
 * Shared pure functions for layout engine input math.
 *
 * Extracted from both Fabric and Konva engines to eliminate duplication.
 * All functions are engine-agnostic — they operate on coordinates and
 * dimensions using the lower-left corner convention.
 */

// ─── Snap-to-Grid ────────────────────────────────────────────────────────────

/**
 * Snap a lower-left corner position to the nearest grid intersection.
 *
 * Used for bin group positioning. Shapes do NOT snap.
 */
export function snapLowerLeft(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize
  }
}

// ─── Resize Quantization ─────────────────────────────────────────────────────

/**
 * Round dimensions to the nearest grid-aligned values.
 * Minimum 1 grid unit per dimension.
 */
export function quantizeResize(
  width: number,
  height: number,
  gridSize: number
): { width: number; height: number } {
  return {
    width: Math.max(gridSize, Math.round(width / gridSize) * gridSize),
    height: Math.max(gridSize, Math.round(height / gridSize) * gridSize)
  }
}

// ─── Edge-Anchor Computation ─────────────────────────────────────────────────

export interface Bounds {
  /** Lower-left x */
  x: number
  /** Lower-left y (largest y in screen coords) */
  y: number
  width: number
  height: number
}

export interface AnchoredResizeResult {
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
 * Given original bounds, scale factors, and the current visual centroid,
 * compute the new position and dimensions with edge anchoring and grid
 * quantization.
 *
 * Edge anchoring: detect which edges are stationary by comparing
 * the visual bounds (scaled from the current centroid) against the
 * original bounds. The edge closest to its original position is the
 * anchor; the opposite edge moves to accommodate the new size.
 *
 * The centroid must come from the engine's current object position
 * (Fabric: obj.left/top, Konva: group.x()/y()) — during a resize the
 * engine shifts the centroid toward the dragged edge, making the
 * anchored edge's visual position stay close to its original.
 *
 * Coordinate convention: lower-left corner (x, y) where y is the
 * largest y in screen coords. Bin extends rightward (+x) by width
 * and upward (-y) by height.
 */
export function computeEdgeAnchor(
  original: Bounds,
  scaleX: number,
  scaleY: number,
  centroidX: number,
  centroidY: number,
  gridSize: number
): AnchoredResizeResult {
  const { width: newW, height: newH } = quantizeResize(
    original.width * scaleX,
    original.height * scaleY,
    gridSize
  )

  // Original edges (lower-left convention)
  const origLeft = original.x
  const origRight = original.x + original.width
  const origBottom = original.y // largest y (lower-left)
  const origTop = original.y - original.height // smallest y (upper-left)

  // Scaled visual edges (from the engine's current centroid)
  const visualLeft = centroidX - (original.width * scaleX) / 2
  const visualRight = centroidX + (original.width * scaleX) / 2
  const visualTop = centroidY - (original.height * scaleY) / 2
  const visualBottom = centroidY + (original.height * scaleY) / 2

  // Detect anchored edges: the edge closest to its original position stays fixed
  const anchoredLeft = Math.abs(visualLeft - origLeft) < Math.abs(visualRight - origRight)
  const anchoredBottom = Math.abs(visualBottom - origBottom) < Math.abs(visualTop - origTop)

  // Compute new lower-left based on which edges are anchored
  const finalX = anchoredLeft ? origLeft : origRight - newW
  const finalY = anchoredBottom ? origBottom : origTop + newH

  return { x: finalX, y: finalY, width: newW, height: newH }
}
