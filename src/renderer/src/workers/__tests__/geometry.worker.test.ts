import { describe, it, expect } from 'vitest'
import type { WorkerRequest, WorkerResponse } from '../../../../shared/types/worker'

describe('WorkerRequest message protocol', () => {
  it('extrude request has required fields', () => {
    const request: WorkerRequest = {
      type: 'extrude',
      id: 'req-1',
      vertices: new Float32Array([0, 0, 1, 0, 0.5, 1]),
      depth: 5,
      direction: 'up',
      role: 'solid'
    }

    expect(request.type).toBe('extrude')
    expect(request.id).toBeDefined()
    expect(request.vertices).toBeInstanceOf(Float32Array)
    expect(request.vertices.length).toBe(6)
    expect(request.depth).toBe(5)
    expect(request.direction).toBe('up')
  })

  it('boolean request has required fields', () => {
    const request: WorkerRequest = {
      type: 'boolean',
      id: 'req-2',
      op: 'subtract',
      meshA: {
        positions: new Float32Array([0, 0, 0]),
        indices: new Uint32Array([0])
      },
      meshB: {
        positions: new Float32Array([1, 1, 1]),
        indices: new Uint32Array([0])
      }
    }

    expect(request.type).toBe('boolean')
    expect(request.id).toBeDefined()
    expect(request.op).toBe('subtract')
    expect(request.meshA).toBeDefined()
    expect(request.meshB).toBeDefined()
  })
})

describe('WorkerResponse message protocol', () => {
  it('extrude response has positions, indices, normals', () => {
    const response: WorkerResponse = {
      type: 'extrude',
      id: 'req-1',
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])
    }

    expect(response.type).toBe('extrude')
    expect(response.id).toBe('req-1')
    expect(response.positions).toBeInstanceOf(Float32Array)
    expect(response.indices).toBeInstanceOf(Uint32Array)
    expect(response.normals).toBeInstanceOf(Float32Array)
  })

  it('error response has error string', () => {
    const response: WorkerResponse = {
      type: 'error',
      id: 'req-1',
      error: 'Invalid polygon: too few vertices'
    }

    expect(response.type).toBe('error')
    expect(response.id).toBe('req-1')
    expect(response.error).toBe('Invalid polygon: too few vertices')
  })

  it('progress response has stage and percent', () => {
    const response: WorkerResponse = {
      type: 'progress',
      id: 'req-1',
      stage: 'triangulating',
      percent: 0.45
    }

    expect(response.type).toBe('progress')
    expect(response.id).toBe('req-1')
    expect(response.stage).toBe('triangulating')
    expect(response.percent).toBe(0.45)
  })
})

describe('WorkerRequest/Response construction', () => {
  it('creating request objects with correct shape does not throw', () => {
    expect(() => {
      const _: WorkerRequest = {
        type: 'extrude',
        id: 'test',
        vertices: new Float32Array([]),
        depth: 1,
        direction: 'up',
        role: 'solid'
      }
      void _
    }).not.toThrow()
  })

  it('Float32Array structured clone roundtrip', () => {
    const original = new Float32Array([1.5, 2.3, -0.7, 42.0, 0.001])

    // Use structuredClone to match actual postMessage behavior
    const cloned = structuredClone(original)

    expect(cloned).toBeInstanceOf(Float32Array)
    expect(cloned.length).toBe(original.length)
    for (let i = 0; i < original.length; i++) {
      expect(cloned[i]).toBeCloseTo(original[i], 5)
    }
  })
})
