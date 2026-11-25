/**
 * Keeps track of where an app update stands, from what electron-updater reports, and tells
 * the windows. It takes the updater as a parameter so it can be tested with a stand-in:
 * the real one only does anything in an installed build.
 */
import { canCheckForUpdates, IDLE_STATE, type UpdateState } from '../shared/types/updates'

/** The part of electron-updater this needs. */
export interface Updater {
  on(event: string, handler: (...args: never[]) => void): unknown
  /** Resolves with nothing, and reports nothing, when this build cannot update itself. */
  checkForUpdatesAndNotify(): Promise<unknown>
}

export interface UpdateControllerOptions {
  updater: Updater
  /** Whether this build can update itself at all: installed, and of a kind that can. */
  active: boolean
  /** Called with each new state, to pass it on to the windows. */
  onState: (state: UpdateState) => void
  logError: (...args: unknown[]) => void
}

export interface UpdateController {
  state(): UpdateState
  /** Look for an update, unless one is being looked for, downloaded, or is ready. */
  check(): void
  /** Look now, and again every hour. Returns what stops it. */
  start(): () => void
}

/** How long a check may go without an answer before it counts as failed. */
export const CHECK_TIMEOUT_MS = 2 * 60 * 1000
/** How long a download may go without progress before it counts as failed. */
export const DOWNLOAD_STALL_MS = 10 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
/** How soon to look again when the newest release has no installers yet. They take minutes. */
export const PREPARING_RETRY_MS = 5 * 60 * 1000

/**
 * Whether a failed check only means the newest release has no update file yet. The updater
 * gives this code when the file is missing (HTTP 404), and for nothing else: a release is
 * published a few minutes before its installers are attached.
 */
function isReleaseStillBuilding(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
}

export function createUpdateController(options: UpdateControllerOptions): UpdateController {
  const { updater, active, onState, logError } = options
  let state: UpdateState = active ? IDLE_STATE : { kind: 'unavailable' }
  let stalled: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null

  /**
   * The updater has no time limit of its own under Electron. Without one, a request that
   * never answers would leave "Checking" or "Downloading" on screen for good, and nothing
   * could be tried again.
   */
  const watch = (): void => {
    if (stalled) clearTimeout(stalled)
    stalled = null
    const limit =
      state.kind === 'checking'
        ? CHECK_TIMEOUT_MS
        : state.kind === 'downloading'
          ? DOWNLOAD_STALL_MS
          : null
    if (limit === null) return
    stalled = setTimeout(() => {
      logError('[updates] no answer from the update server', state.kind)
      set({ kind: 'error', message: 'ETIMEDOUT: no answer from the update server' })
    }, limit)
  }

  const set = (next: UpdateState): void => {
    state = next
    watch()
    if (retry) clearTimeout(retry)
    // The installers are on their way: look again soon, not at the next hourly check.
    retry = next.kind === 'preparing' ? setTimeout(() => check(), PREPARING_RETRY_MS) : null
    onState(next)
  }

  /** What a failed check or download becomes. */
  const fail = (err: unknown): void => {
    if (isReleaseStillBuilding(err)) {
      set({ kind: 'preparing' })
    } else {
      set({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  updater.on('checking-for-update', () => set({ kind: 'checking' }))
  updater.on('update-not-available', () => set({ kind: 'up-to-date' }))
  updater.on('update-available', (info: { version: string }) => {
    set({ kind: 'downloading', version: info.version, progress: 0 })
  })
  updater.on('download-progress', (info: { percent: number }) => {
    const version = state.kind === 'downloading' ? state.version : ''
    set({ kind: 'downloading', version, progress: info.percent })
  })
  updater.on('update-downloaded', (info: { version: string }) => {
    set({ kind: 'downloaded', version: info.version })
  })
  updater.on('error', (err: Error) => {
    logError('[autoUpdater]', err)
    fail(err)
  })

  function check(): void {
    if (!active || !canCheckForUpdates(state)) return
    // Say so at once: the updater's first report can take a moment.
    set({ kind: 'checking' })
    updater.checkForUpdatesAndNotify().then(
      (result) => {
        // Nothing back and nothing reported: this build turned out not to update itself,
        // such as an AppImage that was unpacked, or a snap.
        if (result == null && state.kind === 'checking') set({ kind: 'unavailable' })
      },
      (err: unknown) => {
        // The updater reports an error before it rejects, so this is usually already
        // shown. It is here so a rejection alone can never leave "Checking" on screen.
        logError('[autoUpdater] check failed', err)
        if (state.kind === 'checking') fail(err)
      }
    )
  }

  return {
    state: () => state,
    check,
    start: () => {
      check()
      const hourly = setInterval(check, HOUR_MS)
      return () => {
        clearInterval(hourly)
        if (stalled) clearTimeout(stalled)
        if (retry) clearTimeout(retry)
      }
    }
  }
}
