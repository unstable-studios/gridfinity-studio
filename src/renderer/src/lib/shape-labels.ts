import type { LayoutShape } from '@/layout-engine/types'

const SHAPE_TYPE_LABELS: Record<LayoutShape['type'], string> = {
  rect: 'Rectangle',
  circle: 'Ellipse',
  polygon: 'Polygon',
  svgPath: 'Path',
  meshImport: 'Imported mesh'
}

/** The name shown for a kind of shape. */
export function shapeTypeLabel(type: LayoutShape['type']): string {
  return SHAPE_TYPE_LABELS[type]
}
