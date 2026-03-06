import { useEffect, useRef, useState, useCallback } from 'react'
import type {
  WorkerRequest,
  WorkerResponse,
  MeshDataWithNormals,
  CSGBinParams
} from '../../../shared/types/worker'

interface PendingRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void
  reject: (reason: Error) => void
}

export interface BakePocketsResult extends MeshDataWithNormals {
  warnings: string[]
}

export interface UseGeometryWorkerResult {
  ready: boolean
  extrude: (vertices: Float32Array, depth: number, zTop?: number) => Promise<MeshDataWithNormals>
  bakePockets: (binParams: CSGBinParams) => Promise<BakePocketsResult>
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
        const base = {
          positions: msg.positions,
          indices: msg.indices,
          normals: msg.normals,
          colors: msg.colors
        }
        if (msg.type === 'bake-pockets' || msg.type === 'bake') {
          pending.resolve({ ...base, warnings: msg.warnings })
        } else {
          pending.resolve(base)
        }
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
    (vertices: Float32Array, depth: number, zTop?: number): Promise<MeshDataWithNormals> => {
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
          zTop
        }
        worker.postMessage(message, [verticesCopy.buffer] as unknown as Transferable[])
      })
    },
    []
  )

  const bakePockets = useCallback((binParams: CSGBinParams): Promise<BakePocketsResult> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current
      if (!worker) {
        reject(new Error('Worker not initialized'))
        return
      }

      const id = crypto.randomUUID()
      pendingRef.current.set(id, { resolve, reject })

      const message: WorkerRequest = {
        type: 'bake-pockets',
        id,
        binParams
      }
      worker.postMessage(message)
    })
  }, [])

  return { ready, extrude, bakePockets }
}
