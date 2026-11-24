/**
 * Subscribes to the main process's autoUpdater state and exposes it to the
 * renderer along with the `installNow` and `check` actions.
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
  /** Look for an update now. */
  check: () => void
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

  const check = useCallback(() => {
    window.api?.updates?.check()?.catch((err) => {
      console.warn('[useAppUpdate] check failed:', err)
    })
  }, [])

  return { state, installNow, check }
}
