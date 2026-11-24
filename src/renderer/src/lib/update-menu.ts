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

/** Why an update failed, in a few words. The full message is in the log file. */
function failure(message: string): string {
  if (
    /net::|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|offline/i.test(message)
  ) {
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
      const percent = Math.max(0, Math.min(100, Math.round(state.progress)))
      const what = state.version ? `v${state.version}` : 'update'
      return [{ label: `Downloading ${what}… ${percent}%` }]
    }
    case 'downloaded':
      return [{ label: `Restart to update to v${state.version}`, action: 'install', tone: 'good' }]
    case 'error':
      return [
        { label: failure(state.message), tone: 'bad' },
        { label: 'Try again', action: 'check' },
        { label: 'Download the installer…', action: 'download' }
      ]
  }
}
