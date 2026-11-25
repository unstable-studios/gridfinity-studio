/**
 * Cross-process state machine for electron-updater. The main process emits
 * `updates:state` over IPC on every autoUpdater event; the renderer subscribes
 * via `window.api.updates.onStateChange` and renders the badge + status line.
 *
 * Transitions (driven by autoUpdater events):
 *   idle            (initial, in an installed app)
 *   unavailable     (initial and final, in a build that cannot update itself)
 *   → checking-for-update          → checking
 *   → update-not-available         → up-to-date
 *   → update-available             → downloading { progress: 0 }
 *   → download-progress (repeated) → downloading { progress: % }
 *   → update-downloaded            → downloaded
 *   → error (anywhere)             → error
 *   → error: the newest release has no installers yet → preparing
 *
 * A release is published a few minutes before its installers are built and attached. A
 * check in that gap finds the release but not its update file. That is `preparing`, not a
 * failure, and the check is made again shortly.
 *
 * A check can be asked for again from idle, up-to-date, preparing and error.
 */
export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'checking' }
  | { kind: 'up-to-date' }
  | { kind: 'preparing' }
  | { kind: 'downloading'; version: string; progress: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }

/** Whether a check may be started from this state: not while one is under way or done. */
export function canCheckForUpdates(state: UpdateState): boolean {
  return (
    state.kind === 'idle' ||
    state.kind === 'up-to-date' ||
    state.kind === 'preparing' ||
    state.kind === 'error'
  )
}

export const IDLE_STATE: UpdateState = { kind: 'idle' }

/** IPC channels — kept in one place so main + preload + renderer can't drift. */
export const UPDATE_CHANNELS = {
  /** Main → Renderer broadcast: new UpdateState. */
  state: 'updates:state',
  /** Renderer → Main: read current state on mount (renderer may have started late). */
  getState: 'updates:get-state',
  /** Renderer → Main: quit and install the downloaded update. */
  installNow: 'updates:install-now',
  /** Renderer → Main: look for an update now. */
  check: 'updates:check'
} as const
