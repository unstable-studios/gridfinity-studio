/**
 * The order shapes are stacked in, bottom first: larger under smaller, so a shape drawn
 * inside another can still be clicked and dragged. A click goes to the top shape under the
 * pointer, which is then the smallest one there.
 */

export interface Stacked {
  id: string
  /** Area of the shape's bounding box. */
  area: number
}

/**
 * `shapes` as they are stacked now, bottom first, put largest first. Shapes of one size keep
 * the order they had.
 */
export function largestFirst(shapes: Stacked[]): string[] {
  // A sliver of difference from rounding must not shuffle shapes meant to be the same size.
  const same = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(a, b, 1)
  return shapes
    .map((shape, place) => ({ ...shape, place }))
    .sort((a, b) => (same(a.area, b.area) ? a.place - b.place : b.area - a.area))
    .map((shape) => shape.id)
}
