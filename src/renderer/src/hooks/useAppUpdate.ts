/**
 * Subscribes to the main process's autoUpdater state and exposes it to the
 * renderer along with an `installNow` action.
 *
 * The state machine lives in main (`src/main/index.ts` + `src/shared/types/
 * updates.ts`); this hook is just a thin React wrapper.
 *
 * In dev or browser-fallback (no `window.api.updates`), state stays `idle`
 * and `installNow` is a no-op so callers don't need to guard.
 */
import { useEffect, useState, useCallback } from 'react'
import { IDLE_STATE, type UpdateState } from '../../../shared/types/updates'

export interface UseAppUpdate {
  state: UpdateState
  installNow: () => void
}

export function useAppUpdate(): UseAppUpdate {
  const [state, setState] = useState<UpdateState>(IDLE_STATE)

  useEffect(() => {
    const updates = window.api?.updates
    if (!updates) return

    let cancelled = false
    updates.getState().then(
      (s) => {
        if (!cancelled) setState(s)
      },
      (err) => {
        // Initial sync failed (e.g. main not ready, IPC channel missing) —
        // stay on IDLE_STATE; subsequent broadcasts will still arrive.
        console.warn('[useAppUpdate] getState failed:', err)
      }
    )

    const off = updates.onStateChange(setState)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const installNow = useCallback(() => {
    window.api?.updates?.installNow()?.catch((err) => {
      console.warn('[useAppUpdate] installNow failed:', err)
    })
  }, [])

  return { state, installNow }
}
