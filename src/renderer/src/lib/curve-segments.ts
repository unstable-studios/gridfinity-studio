/**
 * How finely circles and arcs are cut into straight segments for 3D output.
 */

/** Farthest a segment may sit from the true curve, in mm. */
export const CURVE_TOLERANCE = 0.005

const MIN_SEGMENTS = 64
const MAX_SEGMENTS = 360

/**
 * Segments for a full circle of the given radius, so no segment is farther than
 * `CURVE_TOLERANCE` from the circle. Always a multiple of 4, so a circle has a
 * vertex on each axis.
 */
export function circleSegments(radius: number): number {
  if (!(radius > CURVE_TOLERANCE)) return MIN_SEGMENTS
  const needed = Math.PI / Math.acos(1 - CURVE_TOLERANCE / radius)
  const rounded = Math.ceil(needed / 4) * 4
  return Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, rounded))
}
