/**
 * What the Help menu shows about updates: one line saying where things stand, and what can
 * be done about it.
 */
import type { UpdateState } from '../../../shared/types/updates'

export type UpdateAction = 'check' | 'install' | 'download'

export interface UpdateMenuItem {
  label: string
  /** What choosing it does. Without one, the item only says something. */
  action?: UpdateAction
  tone?: 'good' | 'bad'
}

/**
 * Why an update failed, in a few words. The full message is in the log file. Only the codes
 * of a connection that could not be made count as that: a message that merely has "network"
 * in it does not.
 */
function failure(message: string): string {
  if (/net::ERR_|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN/.test(message)) {
    return 'Couldn’t reach the update server'
  }
  return 'Couldn’t update'
}

export function updateMenuItems(state: UpdateState): UpdateMenuItem[] {
  switch (state.kind) {
    case 'unavailable':
      return [{ label: 'This build doesn’t update itself' }]
    case 'idle':
      return [{ label: 'Check for updates', action: 'check' }]
    case 'checking':
      return [{ label: 'Checking for updates…' }]
    case 'up-to-date':
      return [{ label: 'Up to date' }, { label: 'Check again', action: 'check' }]
    case 'downloading': {
      // The updater can report a progress that is not a number, before it knows the size.
      const progress = Number.isFinite(state.progress) ? state.progress : 0
      const percent = Math.max(0, Math.min(100, Math.round(progress)))
      const what = state.version ? `v${state.version}` : 'update'
      return [{ label: `Downloading ${what}… ${percent}%` }]
    }
    case 'downloaded':
      return [{ label: `Restart to update to v${state.version}`, action: 'install', tone: 'good' }]
    case 'error':
      return [
        { label: failure(state.message), tone: 'bad' },
        { label: 'Try again', action: 'check' },
        { label: 'Get the installer from GitHub', action: 'download' }
      ]
  }
}
