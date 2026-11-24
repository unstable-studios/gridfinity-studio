import { describe, expect, it } from 'vitest'
import { shapeTypeLabel } from '../shape-labels'

describe('shapeTypeLabel', () => {
  it('names each kind of shape in words', () => {
    expect(shapeTypeLabel('rect')).toBe('Rectangle')
    expect(shapeTypeLabel('circle')).toBe('Ellipse')
    expect(shapeTypeLabel('polygon')).toBe('Polygon')
    expect(shapeTypeLabel('svgPath')).toBe('Path')
    expect(shapeTypeLabel('meshImport')).toBe('Imported mesh')
  })
})
