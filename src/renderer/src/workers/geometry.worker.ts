import { wallWarnings } from '../lib/wall-clearance'
import type { WorkerRequest, WorkerResponse } from '../../../shared/types/worker'
import { buildBinCSG } from '../lib/bin-csg-builder'
// Imported as a URL so Vite emits a hashed asset (manifold-XXXX.wasm) and
// returns its URL — works in both dev (HTTP) and Electron production
// (file:// protocol). A bare `/manifold.wasm` fails in production because
// `self.location.origin` is empty under file://, leaving the path resolved
// against filesystem root.
import manifoldWasmUrl from 'manifold-3d/manifold.wasm?url'

// Worker globals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any as {
  postMessage: (msg: WorkerResponse, opts?: StructuredSerializeOptions) => void
}

// ─── Manifold WASM state ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let manifoldModule: any = null

async function initManifold(): Promise<boolean> {
  try {
    const Module = (await import('manifold-3d')).default
    manifoldModule = await Module({
      locateFile: () => manifoldWasmUrl
    })
    manifoldModule.setup()
    console.log('[geometry.worker] Manifold WASM initialized successfully')
    return true
  } catch (err) {
    console.error('[geometry.worker] Failed to initialize manifold WASM:', err)
    return false
  }
}

// ─── Message handler ─────────────────────────────────────────────

addEventListener('message', (event: MessageEvent<WorkerRequest>): void => {
  const msg = event.data

  switch (msg.type) {
    case 'init': {
      void initManifold().then((success) => {
        const response: WorkerResponse = {
          type: 'init',
          success,
          error: success ? undefined : 'Failed to load manifold WASM'
        }
        ctx.postMessage(response)
      })
      break
    }

    case 'bake-pockets': {
      if (!manifoldModule) {
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: 'Manifold WASM not initialized'
        } satisfies WorkerResponse)
        break
      }

      try {
        const warnings: string[] = []
        const t0 = performance.now()

        console.log('[worker] Building full CSG bin...')
        const csgResult = buildBinCSG(msg.binParams, manifoldModule)
        const totalMs = (performance.now() - t0).toFixed(1)
        const verts = csgResult.positions.length / 3
        const tris = csgResult.indices.length / 3
        console.log(
          `[worker] CSG bake complete: ${verts} verts, ${tris} tris, ${msg.binParams.pockets.length} pockets (${totalMs}ms)`
        )

        const skipped = csgResult.skippedPockets
        if (skipped.length > 0) {
          const { name: binName, pockets } = msg.binParams
          const where = binName ? `${binName}: ` : ''
          const shapeName = pockets[skipped[0]]?.name
          warnings.push(
            skipped.length === 1
              ? `${where}${shapeName ?? 'A shape'} could not be cut. Redraw or delete it in Design.`
              : `${where}${skipped.length} shapes could not be cut. Redraw or delete them in Design.`
          )
        }

        warnings.push(...wallWarnings(msg.binParams))

        const colors = new Float32Array(0)
        const response: WorkerResponse = {
          type: 'bake-pockets',
          id: msg.id,
          warnings,
          positions: csgResult.positions,
          indices: csgResult.indices,
          normals: csgResult.normals,
          solidVertices: csgResult.solidVertices,
          colors
        }
        ctx.postMessage(response, {
          transfer: [
            csgResult.positions.buffer,
            csgResult.indices.buffer,
            csgResult.normals.buffer,
            csgResult.solidVertices.buffer
          ]
        })
      } catch (err) {
        console.error('[worker] Bake-pockets failed:', err)
        ctx.postMessage({
          type: 'error',
          id: msg.id,
          error: `Bake-pockets failed: ${err instanceof Error ? err.message : String(err)}`
        } satisfies WorkerResponse)
      }
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
