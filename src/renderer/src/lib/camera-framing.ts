/**
 * Camera framing for the 3D preview: where to put a perspective camera so a
 * bounding box fills the view without clipping.
 */

export interface Bounds3 {
  min: [number, number, number]
  max: [number, number, number]
}

export interface CameraFrame {
  position: [number, number, number]
  target: [number, number, number]
  distance: number
}

/** Unit vector from the target toward the camera: front-right, looking down. */
const VIEW_DIRECTION: [number, number, number] = normalize([0.45, 0.55, 0.7])

/** Space left around the model, as a fraction of the fitted distance. */
const MARGIN = 1.15

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2])
  return [v[0] / len, v[1] / len, v[2] / len]
}

/** Stable identity for a bounding box, to tell when the layout has changed. */
export function boundsKey(bounds: Bounds3): string {
  return [...bounds.min, ...bounds.max].map((n) => n.toFixed(2)).join(',')
}

/**
 * Frame `bounds` with a camera of vertical field of view `fovDegrees`.
 * `aspect` is width / height of the area the model should fit in (the part of
 * the canvas not covered by UI). The box's bounding sphere is fitted to the
 * narrower of the two fields of view, so it fits at any orbit angle.
 */
export function frameBounds(bounds: Bounds3, fovDegrees: number, aspect: number): CameraFrame {
  const target: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2
  ]
  const radius =
    Math.hypot(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2]
    ) / 2

  const vertical = (fovDegrees * Math.PI) / 180
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect)
  const distance = (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * MARGIN

  return {
    target,
    distance,
    position: [
      target[0] + VIEW_DIRECTION[0] * distance,
      target[1] + VIEW_DIRECTION[1] * distance,
      target[2] + VIEW_DIRECTION[2] * distance
    ]
  }
}
