/**
 * The box a rectangle or ellipse is drawn into while dragging.
 */

export interface Point {
  x: number
  y: number
}

export interface DrawBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface DrawOptions {
  /** The drag starts at the middle of the shape instead of a corner. */
  fromCenter: boolean
  /** Width and height stay equal: a square or a circle. */
  square: boolean
}

/**
 * Box for a drag from `start` to `current`.
 *
 * From a corner, `start` stays a corner and the box grows toward the pointer. From the center,
 * `start` stays the middle and the pointer sets how far the box reaches on each axis. A square
 * box takes the longer of the two reaches.
 */
export function boxFromDrag(start: Point, current: Point, options: DrawOptions): DrawBox {
  let reachX = Math.abs(current.x - start.x)
  let reachY = Math.abs(current.y - start.y)
  if (options.square) {
    reachX = Math.max(reachX, reachY)
    reachY = reachX
  }

  if (options.fromCenter) {
    return {
      minX: start.x - reachX,
      minY: start.y - reachY,
      maxX: start.x + reachX,
      maxY: start.y + reachY
    }
  }

  // A pointer level with the start still has a side to grow toward: right and down.
  const endX = start.x + (current.x < start.x ? -reachX : reachX)
  const endY = start.y + (current.y < start.y ? -reachY : reachY)
  return {
    minX: Math.min(start.x, endX),
    minY: Math.min(start.y, endY),
    maxX: Math.max(start.x, endX),
    maxY: Math.max(start.y, endY)
  }
}
