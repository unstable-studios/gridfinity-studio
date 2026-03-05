import { useEffect, useRef, useState, useCallback } from 'react'
import type {
  WorkerRequest,
  WorkerResponse,
  MeshDataWithNormals
} from '../../../shared/types/worker'

interface PendingRequest {
  resolve: (value: MeshDataWithNormals) => void
  reject: (reason: Error) => void
}

export interface UseGeometryWorkerResult {
  ready: boolean
  extrude: (
    vertices: Float32Array,
    depth: number,
    direction: 'up' | 'down',
    role: 'solid' | 'cutter'
  ) => Promise<MeshDataWithNormals>
}

export function useGeometryWorker(): UseGeometryWorkerResult {
  const [ready, setReady] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())

  useEffect(() => {
    const worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), {
      type: 'module'
    })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<WorkerResponse>): void => {
      const msg = event.data

      if (msg.type === 'init') {
        setReady(msg.success)
        return
      }

      if (msg.type === 'error') {
        const id = msg.id
        if (id) {
          const pending = pendingRef.current.get(id)
          if (pending) {
            pendingRef.current.delete(id)
            pending.reject(new Error(msg.error))
          }
        }
        return
      }

      if (msg.type === 'progress') {
        return
      }

      const id = msg.id
      const pending = pendingRef.current.get(id)
      if (pending) {
        pendingRef.current.delete(id)
        pending.resolve({
          positions: msg.positions,
          indices: msg.indices,
          normals: msg.normals,
          colors: msg.colors
        })
      }
    }

    const initMessage: WorkerRequest = { type: 'init' }
    worker.postMessage(initMessage)

    const pending = pendingRef.current
    return () => {
      worker.terminate()
      workerRef.current = null
      for (const [, req] of pending) {
        req.reject(new Error('Worker terminated'))
      }
      pending.clear()
    }
  }, [])

  const extrude = useCallback(
    (
      vertices: Float32Array,
      depth: number,
      direction: 'up' | 'down',
      role: 'solid' | 'cutter'
    ): Promise<MeshDataWithNormals> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current
        if (!worker) {
          reject(new Error('Worker not initialized'))
          return
        }

        const id = crypto.randomUUID()
        pendingRef.current.set(id, { resolve, reject })

        // Copy vertices so transferring the buffer doesn't detach the caller's array
        const verticesCopy = new Float32Array(vertices)

        const message: WorkerRequest = {
          type: 'extrude',
          id,
          vertices: verticesCopy,
          depth,
          direction,
          role
        }
        worker.postMessage(message, [verticesCopy.buffer] as unknown as Transferable[])
      })
    },
    []
  )

  return { ready, extrude }
}
