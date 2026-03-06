import { describe, it, expect } from 'vitest'
import { extrudePolygon, offsetPolygon } from '../extrude'

describe('extrudePolygon', () => {
  it('extruding a triangle produces valid mesh data', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 }
    ]

    const result = extrudePolygon(triangle, 5)

    expect(result.positions).toBeDefined()
    expect(result.indices).toBeDefined()
    expect(result.normals).toBeDefined()
    expect(result.positions.length).toBeGreaterThan(0)
    expect(result.indices.length).toBeGreaterThan(0)
    expect(result.normals.length).toBeGreaterThan(0)
  })

  it('extruding a rectangle produces correct vertex count', () => {
    const rectangle = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 }
    ]

    const result = extrudePolygon(rectangle, 3)

    const vertexCount = result.positions.length / 3
    expect(vertexCount).toBeGreaterThanOrEqual(8)
  })

  it('default zTop=0 places top at 0 and bottom at -depth', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]
    const depth = 10

    const result = extrudePolygon(square, depth)
    const zValues: number[] = []
    for (let i = 2; i < result.positions.length; i += 3) {
      zValues.push(result.positions[i])
    }

    const minZ = Math.min(...zValues)
    const maxZ = Math.max(...zValues)

    expect(maxZ).toBeCloseTo(0)
    expect(minZ).toBeCloseTo(-depth)
  })

  it('zTop positions the extrusion at the specified height', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]
    const depth = 5
    const zTop = 20

    const result = extrudePolygon(square, depth, zTop)
    const zValues: number[] = []
    for (let i = 2; i < result.positions.length; i += 3) {
      zValues.push(result.positions[i])
    }

    expect(Math.max(...zValues)).toBeCloseTo(zTop)
    expect(Math.min(...zValues)).toBeCloseTo(zTop - depth)
  })

  it('depth is reflected in vertex positions', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]

    const result5 = extrudePolygon(square, 5)
    const result20 = extrudePolygon(square, 20)

    const zValues5: number[] = []
    for (let i = 2; i < result5.positions.length; i += 3) {
      zValues5.push(result5.positions[i])
    }
    const zValues20: number[] = []
    for (let i = 2; i < result20.positions.length; i += 3) {
      zValues20.push(result20.positions[i])
    }

    const span5 = Math.max(...zValues5) - Math.min(...zValues5)
    const span20 = Math.max(...zValues20) - Math.min(...zValues20)

    expect(span5).toBeCloseTo(5)
    expect(span20).toBeCloseTo(20)
  })

  it('all normals are unit length', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 }
    ]

    const result = extrudePolygon(triangle, 5)

    for (let i = 0; i < result.normals.length; i += 3) {
      const nx = result.normals[i]
      const ny = result.normals[i + 1]
      const nz = result.normals[i + 2]
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
      expect(length).toBeCloseTo(1, 4)
    }
  })

  it('all indices are valid', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 }
    ]

    const result = extrudePolygon(triangle, 5)
    const vertexCount = result.positions.length / 3

    for (const index of result.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })

  it('empty vertices returns empty', () => {
    const result = extrudePolygon([], 5)
    expect(result.positions.length).toBe(0)
    expect(result.indices.length).toBe(0)
  })

  it('single vertex returns empty', () => {
    const result = extrudePolygon([{ x: 0, y: 0 }], 5)
    expect(result.positions.length).toBe(0)
    expect(result.indices.length).toBe(0)
  })

  it('two vertices returns empty', () => {
    const result = extrudePolygon(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      5
    )
    expect(result.positions.length).toBe(0)
    expect(result.indices.length).toBe(0)
  })
})

describe('offsetPolygon', () => {
  it('zero offset returns original vertices', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]
    const result = offsetPolygon(square, 0)
    expect(result).toBe(square)
  })

  it('positive offset expands polygon outward', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    const result = offsetPolygon(square, 1)

    // Each vertex should move outward — bounding box should be larger
    const xs = result.map((v) => v.x)
    const ys = result.map((v) => v.y)
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(10)
    expect(Math.min(...ys)).toBeLessThan(0)
    expect(Math.max(...ys)).toBeGreaterThan(10)
  })

  it('negative offset shrinks polygon inward', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    const result = offsetPolygon(square, -1)

    const xs = result.map((v) => v.x)
    const ys = result.map((v) => v.y)
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThan(10)
    expect(Math.min(...ys)).toBeGreaterThan(0)
    expect(Math.max(...ys)).toBeLessThan(10)
  })

  it('preserves vertex count', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2.5, y: 4 }
    ]
    const result = offsetPolygon(triangle, 0.5)
    expect(result.length).toBe(3)
  })
})
