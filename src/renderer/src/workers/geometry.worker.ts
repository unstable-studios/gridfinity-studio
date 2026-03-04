import type { WorkerRequest, WorkerResponse } from '../../../shared/types/worker'
import { extrudePolygon } from '../lib/extrude'

// Worker globals are available at runtime but TS compiles with DOM lib.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any as {
  postMessage: (msg: WorkerResponse, opts?: StructuredSerializeOptions) => void
}

addEventListener('message', (event: MessageEvent<WorkerRequest>): void => {
  const msg = event.data

  switch (msg.type) {
    case 'init': {
      const response: WorkerResponse = { type: 'init', success: true }
      ctx.postMessage(response)
      break
    }

    case 'extrude': {
      const vertexCount = msg.vertices.length / 2
      const vertices: Array<{ x: number; y: number }> = []
      for (let i = 0; i < vertexCount; i++) {
        vertices.push({ x: msg.vertices[i * 2], y: msg.vertices[i * 2 + 1] })
      }

      const result = extrudePolygon(vertices, msg.depth, msg.direction)
      const response: WorkerResponse = {
        type: 'extrude',
        id: msg.id,
        positions: result.positions,
        indices: result.indices,
        normals: result.normals
      }
      ctx.postMessage(response, {
        transfer: [result.positions.buffer, result.indices.buffer, result.normals.buffer]
      })
      break
    }

    case 'boolean': {
      const response: WorkerResponse = {
        type: 'error',
        id: msg.id,
        error: 'Boolean operations not yet implemented'
      }
      ctx.postMessage(response)
      break
    }

    case 'bake': {
      const response: WorkerResponse = {
        type: 'error',
        id: msg.id,
        error: 'Bake not yet implemented'
      }
      ctx.postMessage(response)
      break
    }

    default: {
      const response: WorkerResponse = {
        type: 'error',
        error: `Unknown message type: ${(msg as { type: string }).type}`
      }
      ctx.postMessage(response)
      break
    }
  }
})
