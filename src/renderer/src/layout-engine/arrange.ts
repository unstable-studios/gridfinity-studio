/**
 * Engine-agnostic align math. Works on world-space bounding boxes
 * (screen-y-down: minY is the top edge) and returns how far each shape has to
 * move. Shapes that are already in place are left out.
 */

import type { ShapeAABB } from './containment'

export const ALIGN_MODES = ['left', 'centerX', 'right', 'top', 'centerY', 'bottom'] as const
export type AlignMode = (typeof ALIGN_MODES)[number]

export interface ArrangeBox extends ShapeAABB {
  id: string
}

export interface ShapeMove {
  id: string
  dx: number
  dy: number
}

const EPSILON = 1e-6

/** The box that encloses all of `boxes`. */
export function boundsOf(boxes: ShapeAABB[]): ShapeAABB {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY))
  }
}

function toMoves(boxes: ArrangeBox[], delta: (box: ArrangeBox) => [number, number]): ShapeMove[] {
  const moves: ShapeMove[] = []
  for (const box of boxes) {
    const [dx, dy] = delta(box)
    if (Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON) moves.push({ id: box.id, dx, dy })
  }
  return moves
}

/**
 * Line `boxes` up against one edge or center line of `frame`, which defaults
 * to the box enclosing them all.
 */
export function alignMoves(
  boxes: ArrangeBox[],
  mode: AlignMode,
  frame: ShapeAABB = boundsOf(boxes)
): ShapeMove[] {
  if (boxes.length === 0) return []
  return toMoves(boxes, (box) => {
    switch (mode) {
      case 'left':
        return [frame.minX - box.minX, 0]
      case 'centerX':
        return [(frame.minX + frame.maxX) / 2 - (box.minX + box.maxX) / 2, 0]
      case 'right':
        return [frame.maxX - box.maxX, 0]
      case 'top':
        return [0, frame.minY - box.minY]
      case 'centerY':
        return [0, (frame.minY + frame.maxY) / 2 - (box.minY + box.maxY) / 2]
      case 'bottom':
        return [0, frame.maxY - box.maxY]
    }
  })
}
