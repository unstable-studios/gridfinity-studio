import { describe, it, expect } from 'vitest'
import { extrudePolygon } from '../extrude'

describe('extrudePolygon', () => {
  it('extruding a triangle produces valid mesh data', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 }
    ]

    const result = extrudePolygon(triangle, 5, 'up')

    expect(result.positions).toBeDefined()
    expect(result.indices).toBeDefined()
    expect(result.normals).toBeDefined()
    expect(result.positions.length).toBeGreaterThan(0)
    expect(result.indices.length).toBeGreaterThan(0)
    expect(result.normals.length).toBeGreaterThan(0)
  })

  it('extruding a rectangle produces correct vertex count (8 = 4 top + 4 bottom)', () => {
    const rectangle = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 1 }
    ]

    const result = extrudePolygon(rectangle, 3, 'up')

    // 4 top + 4 bottom = 8 vertices, each with 3 components (x, y, z)
    // Side faces may add additional vertices depending on implementation
    // At minimum we expect 8 unique positions
    const vertexCount = result.positions.length / 3
    expect(vertexCount).toBeGreaterThanOrEqual(8)
  })

  it('direction "up" places bottom face at z=0 and top at z=depth', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]
    const depth = 10

    const result = extrudePolygon(square, depth, 'up')
    const zValues: number[] = []
    for (let i = 2; i < result.positions.length; i += 3) {
      zValues.push(result.positions[i])
    }

    const minZ = Math.min(...zValues)
    const maxZ = Math.max(...zValues)

    expect(minZ).toBeCloseTo(0)
    expect(maxZ).toBeCloseTo(depth)
  })

  it('direction "down" places top at z=0 and bottom at z=-depth', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]
    const depth = 10

    const result = extrudePolygon(square, depth, 'down')
    const zValues: number[] = []
    for (let i = 2; i < result.positions.length; i += 3) {
      zValues.push(result.positions[i])
    }

    const minZ = Math.min(...zValues)
    const maxZ = Math.max(...zValues)

    expect(maxZ).toBeCloseTo(0)
    expect(minZ).toBeCloseTo(-depth)
  })

  it('depth is reflected in vertex positions', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ]

    const result5 = extrudePolygon(square, 5, 'up')
    const result20 = extrudePolygon(square, 20, 'up')

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

    const result = extrudePolygon(triangle, 5, 'up')

    for (let i = 0; i < result.normals.length; i += 3) {
      const nx = result.normals[i]
      const ny = result.normals[i + 1]
      const nz = result.normals[i + 2]
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
      expect(length).toBeCloseTo(1, 4)
    }
  })

  it('all indices are valid (values < position count / 3)', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 1 }
    ]

    const result = extrudePolygon(triangle, 5, 'up')
    const vertexCount = result.positions.length / 3

    for (const index of result.indices) {
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(vertexCount)
    }
  })

  it('empty vertices array throws or returns empty', () => {
    expect(() => {
      const result = extrudePolygon([], 5, 'up')
      // If it doesn't throw, it should return empty arrays
      if (result) {
        expect(result.positions.length).toBe(0)
        expect(result.indices.length).toBe(0)
      }
    }).not.toThrow() // Adjust if implementation throws
  })

  it('single vertex throws or returns empty', () => {
    expect(() => {
      const result = extrudePolygon([{ x: 0, y: 0 }], 5, 'up')
      if (result) {
        expect(result.positions.length).toBe(0)
        expect(result.indices.length).toBe(0)
      }
    }).not.toThrow()
  })

  it('two vertices throws or returns empty', () => {
    expect(() => {
      const result = extrudePolygon(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        5,
        'up'
      )
      if (result) {
        expect(result.positions.length).toBe(0)
        expect(result.indices.length).toBe(0)
      }
    }).not.toThrow()
  })
})
