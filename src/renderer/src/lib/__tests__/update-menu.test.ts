import { describe, expect, it } from 'vitest'
import { updateMenuItems } from '../update-menu'
import { canCheckForUpdates, type UpdateState } from '../../../../shared/types/updates'

const labels = (state: UpdateState): string[] => updateMenuItems(state).map((item) => item.label)
const actions = (state: UpdateState): Array<string | undefined> =>
  updateMenuItems(state).map((item) => item.action)

describe('updateMenuItems', () => {
  it('offers a check before one has run', () => {
    expect(updateMenuItems({ kind: 'idle' })).toEqual([
      { label: 'Check for updates', action: 'check' }
    ])
  })

  it('only says so while checking or downloading', () => {
    expect(actions({ kind: 'checking' })).toEqual([undefined])
    expect(labels({ kind: 'downloading', version: '1.2.3', progress: 41.6 })).toEqual([
      'Downloading v1.2.3… 42%'
    ])
    expect(labels({ kind: 'downloading', version: '', progress: 250 })).toEqual([
      'Downloading update… 100%'
    ])
  })

  it('shows 0% for a progress that is not a number', () => {
    expect(labels({ kind: 'downloading', version: '1.2.3', progress: NaN })).toEqual([
      'Downloading v1.2.3… 0%'
    ])
  })

  it('does not call it a connection failure because the message mentions a network', () => {
    const message = 'Cannot parse releases feed: unexpected token in network section'
    expect(labels({ kind: 'error', message })[0]).toBe('Couldn’t update')
    expect(labels({ kind: 'error', message: 'ETIMEDOUT: no answer' })[0]).toBe(
      'Couldn’t reach the update server'
    )
  })

  it('says it is up to date and offers to check again', () => {
    expect(labels({ kind: 'up-to-date' })).toEqual(['Up to date', 'Check again'])
    expect(actions({ kind: 'up-to-date' })).toEqual([undefined, 'check'])
  })

  it('offers the restart when an update is ready', () => {
    expect(updateMenuItems({ kind: 'downloaded', version: '1.2.3' })).toEqual([
      { label: 'Restart to update to v1.2.3', action: 'install', tone: 'good' }
    ])
  })

  it('after a failure, says what went wrong and offers two ways on', () => {
    expect(labels({ kind: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' })).toEqual([
      'Couldn’t reach the update server',
      'Try again',
      'Get the installer from GitHub'
    ])
    expect(actions({ kind: 'error', message: 'sha512 checksum mismatch' })).toEqual([
      undefined,
      'check',
      'download'
    ])
    expect(labels({ kind: 'error', message: 'sha512 checksum mismatch' })[0]).toBe(
      'Couldn’t update'
    )
  })

  it('offers nothing in a build that cannot update', () => {
    expect(actions({ kind: 'unavailable' })).toEqual([undefined])
  })
})

describe('canCheckForUpdates', () => {
  it('allows a check when nothing is under way', () => {
    expect(canCheckForUpdates({ kind: 'idle' })).toBe(true)
    expect(canCheckForUpdates({ kind: 'up-to-date' })).toBe(true)
    expect(canCheckForUpdates({ kind: 'error', message: 'x' })).toBe(true)
  })

  it('does not start a second check, or one that would throw away a download', () => {
    expect(canCheckForUpdates({ kind: 'checking' })).toBe(false)
    expect(canCheckForUpdates({ kind: 'downloading', version: '1', progress: 5 })).toBe(false)
    expect(canCheckForUpdates({ kind: 'downloaded', version: '1' })).toBe(false)
    expect(canCheckForUpdates({ kind: 'unavailable' })).toBe(false)
  })
})
