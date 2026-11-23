import type { LayoutGroup, LayoutShape } from './types'

/** What a shape's position is measured from. */
export type PositionFrame = 'canvas' | 'bin'

/**
 * A shape in a bin stores its position relative to the bin's center. This is
 * what to add to that stored position to get the position in `frame`, and to
 * subtract from a position in `frame` to get the one to store.
 *
 * A shape outside every bin is already stored in canvas coordinates, whatever
 * `frame` asks for.
 */
export function frameOffset(
  shape: Pick<LayoutShape, 'groupId'>,
  bin: Pick<LayoutGroup, 'x' | 'y' | 'width' | 'height'> | undefined,
  frame: PositionFrame
): { x: number; y: number } {
  if (!shape.groupId || !bin || frame === 'bin') return { x: 0, y: 0 }
  // Group x/y is the lower-left corner; the bin extends up (−y) by height.
  return { x: bin.x + bin.width / 2, y: bin.y - bin.height / 2 }
}
