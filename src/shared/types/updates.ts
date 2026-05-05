/**
 * Cross-process state machine for electron-updater. The main process emits
 * `updates:state` over IPC on every autoUpdater event; the renderer subscribes
 * via `window.api.updates.onStateChange` and renders the badge + status line.
 *
 * Transitions (driven by autoUpdater events):
 *   idle            (initial)
 *   → checking-for-update          → checking
 *   → update-not-available         → idle
 *   → update-available             → downloading { progress: 0 }
 *   → download-progress (repeated) → downloading { progress: % }
 *   → update-downloaded            → downloaded
 *   → error (anywhere)             → error
 */
export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'downloading'; version: string; progress: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }

export const IDLE_STATE: UpdateState = { kind: 'idle' }

/** IPC channels — kept in one place so main + preload + renderer can't drift. */
export const UPDATE_CHANNELS = {
  /** Main → Renderer broadcast: new UpdateState. */
  state: 'updates:state',
  /** Renderer → Main: read current state on mount (renderer may have started late). */
  getState: 'updates:get-state',
  /** Renderer → Main: quit and install the downloaded update. */
  installNow: 'updates:install-now'
} as const
