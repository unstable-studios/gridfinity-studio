import type { LayoutGroup, LayoutShape } from './types'

/** What a shape's position is measured from. */
export type PositionFrame = 'canvas' | 'bin'

export interface Point {
  x: number
  y: number
}

type BinBox = Pick<LayoutGroup, 'x' | 'y' | 'width' | 'height'>

/**
 * Positions are shown to the person with the origin at the lower left, X
 * increasing to the right and Y increasing upward: the canvas origin on the
 * canvas, the bin's lower-left corner relative to a bin.
 *
 * They are stored differently: Y increases downward, and a shape in a bin is
 * stored relative to the bin's center. This is the one place that converts.
 *
 * Both directions use the same pair of numbers:
 *   shown.x = stored.x + origin.x      shown.y = origin.y − stored.y
 *
 * A shape outside every bin is on the canvas, whatever `frame` asks for.
 */
function frameOrigin(
  shape: Pick<LayoutShape, 'groupId'>,
  bin: BinBox | undefined,
  frame: PositionFrame
): Point {
  if (!shape.groupId || !bin) return { x: 0, y: 0 }
  if (frame === 'bin') return { x: bin.width / 2, y: bin.height / 2 }
  // Group x/y is the lower-left corner in stored (Y-down) coordinates, so the
  // bin's center is at (x + width/2, y − height/2).
  return { x: bin.x + bin.width / 2, y: -(bin.y - bin.height / 2) }
}

/** A stored position as it is shown in `frame`. */
export function toShownPosition(
  shape: Pick<LayoutShape, 'groupId' | 'x' | 'y'>,
  bin: BinBox | undefined,
  frame: PositionFrame
): Point {
  const origin = frameOrigin(shape, bin, frame)
  return { x: shape.x + origin.x, y: origin.y - shape.y }
}

/** The stored value for whichever of X and Y is given as shown in `frame`. */
export function toStoredPosition(
  shown: Partial<Point>,
  shape: Pick<LayoutShape, 'groupId'>,
  bin: BinBox | undefined,
  frame: PositionFrame
): Partial<Point> {
  const origin = frameOrigin(shape, bin, frame)
  return {
    ...(shown.x !== undefined && { x: shown.x - origin.x }),
    ...(shown.y !== undefined && { y: origin.y - shown.y })
  }
}

/**
 * The range a shown position can take. Relative to a bin, a shape's center
 * stays inside the bin, so the numbers always mean the same thing. On the
 * canvas there is no limit.
 */
export function shownPositionLimits(
  shape: Pick<LayoutShape, 'groupId'>,
  bin: BinBox | undefined,
  frame: PositionFrame
): { min: Point; max: Point } | null {
  if (!shape.groupId || !bin || frame !== 'bin') return null
  return { min: { x: 0, y: 0 }, max: { x: bin.width, y: bin.height } }
}
