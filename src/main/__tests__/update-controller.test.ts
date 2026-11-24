import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_TIMEOUT_MS,
  DOWNLOAD_STALL_MS,
  createUpdateController,
  type UpdateController
} from '../update-controller'
import type { UpdateState } from '../../shared/types/updates'

/** A stand-in for electron-updater: the test says what it reports, and when. */
class FakeUpdater {
  private handlers = new Map<string, (...args: never[]) => void>()
  checks = 0
  /** What the next check does once the test lets it finish. */
  private settle: { resolve: (value: unknown) => void; reject: (err: unknown) => void } | null =
    null

  on(event: string, handler: (...args: never[]) => void): void {
    this.handlers.set(event, handler)
  }

  emit(event: string, payload?: unknown): void {
    ;(this.handlers.get(event) as ((payload: unknown) => void) | undefined)?.(payload)
  }

  checkForUpdatesAndNotify(): Promise<unknown> {
    this.checks++
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject }
    })
  }

  async resolve(value: unknown): Promise<void> {
    this.settle?.resolve(value)
    await Promise.resolve()
  }

  async reject(err: unknown): Promise<void> {
    this.settle?.reject(err)
    await Promise.resolve()
    await Promise.resolve()
  }
}

describe('the update controller', () => {
  let updater: FakeUpdater
  let seen: UpdateState[]
  let logged: unknown[][]
  const make = (active = true): UpdateController =>
    createUpdateController({
      updater,
      active,
      onState: (state) => seen.push(state),
      logError: (...args) => logged.push(args)
    })
  const kinds = (): string[] => seen.map((state) => state.kind)

  beforeEach(() => {
    vi.useFakeTimers()
    updater = new FakeUpdater()
    seen = []
    logged = []
  })

  afterEach(() => vi.useRealTimers())

  it('finds nothing newer', async () => {
    const updates = make()
    updates.check()
    updater.emit('checking-for-update')
    updater.emit('update-not-available')
    await updater.resolve({})

    expect(kinds()).toEqual(['checking', 'checking', 'up-to-date'])
    expect(updates.state()).toEqual({ kind: 'up-to-date' })
  })

  it('downloads an update and reports its progress', () => {
    const updates = make()
    updates.check()
    updater.emit('update-available', { version: '1.2.3' })
    updater.emit('download-progress', { percent: 40 })
    updater.emit('update-downloaded', { version: '1.2.3' })

    expect(seen.slice(1)).toEqual([
      { kind: 'downloading', version: '1.2.3', progress: 0 },
      { kind: 'downloading', version: '1.2.3', progress: 40 },
      { kind: 'downloaded', version: '1.2.3' }
    ])
    expect(updates.state().kind).toBe('downloaded')
  })

  it('shows a failed check once, though the updater reports it and then rejects', async () => {
    make().check()
    updater.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'))
    await updater.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))

    expect(kinds()).toEqual(['checking', 'error'])
  })

  it('does not stay on "checking" when the updater only rejects', async () => {
    const updates = make()
    updates.check()
    await updater.reject(new Error('boom'))

    expect(updates.state()).toEqual({ kind: 'error', message: 'boom' })
  })

  it('says the build cannot update when the updater answers with nothing', async () => {
    // A snap, or an AppImage that was unpacked: packaged, but the updater does nothing.
    const updates = make()
    updates.check()
    await updater.resolve(null)

    expect(updates.state()).toEqual({ kind: 'unavailable' })
    // And it stops asking.
    updates.check()
    expect(updater.checks).toBe(1)
  })

  it('never asks the updater in a build that cannot update', () => {
    const updates = make(false)
    expect(updates.state()).toEqual({ kind: 'unavailable' })
    updates.check()
    updates.start()()
    expect(updater.checks).toBe(0)
    expect(seen).toEqual([])
  })

  it('does not start a second check, or one that would throw away a download', () => {
    const updates = make()
    updates.check()
    updates.check()
    expect(updater.checks).toBe(1)

    updater.emit('update-available', { version: '1.2.3' })
    updates.check()
    updater.emit('update-downloaded', { version: '1.2.3' })
    updates.check()
    expect(updater.checks).toBe(1)
  })

  it('lets a failed download be tried again', () => {
    const updates = make()
    updates.check()
    updater.emit('update-available', { version: '1.2.3' })
    updater.emit('error', new Error('sha512 checksum mismatch'))
    expect(updates.state().kind).toBe('error')

    updates.check()
    expect(updater.checks).toBe(2)
    expect(updates.state().kind).toBe('checking')
  })

  it('lets a failure after "ready" be tried again, as on a Mac that cannot install', () => {
    const updates = make()
    updates.check()
    updater.emit('update-downloaded', { version: '1.2.3' })
    updater.emit('error', new Error('Could not move the app'))

    expect(updates.state().kind).toBe('error')
    updates.check()
    expect(updater.checks).toBe(2)
  })

  it('gives up on a check that gets no answer', () => {
    const updates = make()
    updates.check()
    vi.advanceTimersByTime(CHECK_TIMEOUT_MS - 1)
    expect(updates.state().kind).toBe('checking')
    vi.advanceTimersByTime(1)

    expect(updates.state().kind).toBe('error')
    // Which can then be tried again.
    updates.check()
    expect(updater.checks).toBe(2)
  })

  it('gives up on a download that stops making progress, but not on a slow one', () => {
    const updates = make()
    updates.check()
    updater.emit('update-available', { version: '1.2.3' })
    // Slow but alive: progress keeps arriving.
    for (let i = 1; i <= 5; i++) {
      vi.advanceTimersByTime(DOWNLOAD_STALL_MS - 1)
      updater.emit('download-progress', { percent: i })
    }
    expect(updates.state().kind).toBe('downloading')

    vi.advanceTimersByTime(DOWNLOAD_STALL_MS)
    expect(updates.state().kind).toBe('error')
  })

  it('does not time out once an answer has come', () => {
    const updates = make()
    updates.check()
    updater.emit('update-not-available')
    vi.advanceTimersByTime(CHECK_TIMEOUT_MS * 10)
    expect(updates.state().kind).toBe('up-to-date')

    updates.check()
    updater.emit('update-downloaded', { version: '1.2.3' })
    vi.advanceTimersByTime(DOWNLOAD_STALL_MS * 10)
    expect(updates.state().kind).toBe('downloaded')
  })

  it('checks at launch and every hour, skipping an hour when busy', () => {
    const stop = make().start()
    expect(updater.checks).toBe(1)
    updater.emit('update-not-available')

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(updater.checks).toBe(2)
    // An update is ready: the hourly check leaves it alone.
    updater.emit('update-downloaded', { version: '1.2.3' })
    vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    expect(updater.checks).toBe(2)

    stop()
  })

  it('logs every failure', async () => {
    make().check()
    updater.emit('error', new Error('one'))
    expect(logged).toHaveLength(1)
  })
})
