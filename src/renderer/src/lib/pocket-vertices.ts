import type { LayoutShape } from '@/layout-engine/types'
import { circleSegments } from './curve-segments'

/**
 * Convert a 2D LayoutShape into pocket-local vertex array (Float32Array of
 * [x0,y0,x1,y1,...]). Coordinates are centered at the shape's origin (the
 * pocket's posX/posY positions the shape on the bin).
 *
 * Output is in math y-up convention (Manifold/CrossSection convention).
 * Editor y is screen-y-down; for shapes built from editor input (polygon),
 * flip y on the way out.
 */
export function shapeToPocketVertices(shape: LayoutShape): Float32Array | null {
  switch (shape.type) {
    case 'rect': {
      const hw = shape.width / 2
      const hh = shape.height / 2
      // CCW in math y-up: bottom-left → bottom-right → top-right → top-left.
      // Rect is symmetric, so the editor-y-flip we do for posY doesn't apply
      // to its vertices.
      return new Float32Array([-hw, -hh, hw, -hh, hw, hh, -hw, hh])
    }
    case 'circle': {
      // CCW in math y-up by construction (sin goes positive for small
      // positive angles). Symmetric around origin so no editor-y flip.
      const segments = circleSegments(Math.max(shape.radiusX, shape.radiusY))
      const verts = new Float32Array(segments * 2)
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        verts[i * 2] = shape.radiusX * Math.cos(angle)
        verts[i * 2 + 1] = shape.radiusY * Math.sin(angle)
      }
      return verts
    }
    case 'polygon': {
      const pts = shape.points
      if (pts.length < 3) return null
      // Polygon vertices come from the editor (screen-y-down) — flip y on
      // the way out so the polygon ends up in math y-up convention,
      // matching the rect/circle output. Mirroring across X reverses
      // winding, so reuse the post-flip vertices for the area test.
      const flipped = pts.map((p) => ({ x: p.x, y: -p.y }))
      let area2 = 0
      for (let i = 0; i < flipped.length; i++) {
        const a = flipped[i]
        const b = flipped[(i + 1) % flipped.length]
        area2 += a.x * b.y - b.x * a.y
      }
      // Manifold's CrossSection treats CW polygons as inverted ("everything
      // outside"); subtracting that from the bin would wipe all visible
      // geometry. Reverse iteration when the polygon comes out CW so the
      // cutter is always a valid filled region.
      const reverse = area2 < 0
      const verts = new Float32Array(flipped.length * 2)
      for (let i = 0; i < flipped.length; i++) {
        const src = reverse ? flipped[flipped.length - 1 - i] : flipped[i]
        verts[i * 2] = src.x
        verts[i * 2 + 1] = src.y
      }
      return verts
    }
    case 'svgPath':
    case 'meshImport':
      // Out of scope for MVP — would need path tessellation / mesh import.
      return null
  }
}
