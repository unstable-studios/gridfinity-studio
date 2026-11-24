import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { CLOSE_GUARD_CHANNELS } from '../../shared/types/close-guard'

const electron = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: Emitter } = require('node:events') as typeof import('node:events')
  return {
    app: Object.assign(new Emitter(), { quit: vi.fn() }),
    ipcMain: new Emitter(),
    dialog: { showMessageBox: vi.fn() }
  }
})
vi.mock('electron', () => electron)

import { guardUnsavedWork, settleUnsavedWork } from '../close-guard'

const SAVE = 0
const DISCARD = 1
const CANCEL = 2

/** A stand-in for a window: `close()` asks its listeners, and closes unless one objects. */
class FakeWindow extends EventEmitter {
  webContents = Object.assign(new EventEmitter(), {
    send: vi.fn(),
    isCrashed: () => false
  })
  destroyed = false

  close(): void {
    let prevented = false
    this.emit('close', { preventDefault: () => (prevented = true) })
    if (prevented) return
    this.destroyed = true
    this.emit('closed')
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
  isMinimized(): boolean {
    return false
  }
  restore = vi.fn()
  show = vi.fn()
}

/** Let the promises behind a close settle. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const openWindows: FakeWindow[] = []

function guardedWindow(unsaved: boolean): FakeWindow {
  const win = new FakeWindow()
  openWindows.push(win)
  guardUnsavedWork(win as unknown as BrowserWindow)
  electron.ipcMain.emit(CLOSE_GUARD_CHANNELS.setUnsaved, { sender: win.webContents }, unsaved)
  return win
}

function answer(response: number): void {
  electron.dialog.showMessageBox.mockResolvedValue({ response })
}

/** What the renderer does when asked to save. */
function rendererSaves(win: FakeWindow, saved: boolean): void {
  win.webContents.send.mockImplementation(() => {
    electron.ipcMain.emit(CLOSE_GUARD_CHANNELS.saveResult, { sender: win.webContents }, saved)
  })
}

beforeEach(() => {
  electron.dialog.showMessageBox.mockReset()
  electron.app.quit.mockReset()
})

// A window left open by one test would be asked about by `settleUnsavedWork` in the next.
afterEach(() => {
  for (const win of openWindows.splice(0)) {
    if (win.destroyed) continue
    win.destroyed = true
    win.emit('closed')
  }
})

describe('guardUnsavedWork', () => {
  it('closes without a question when nothing is unsaved', () => {
    const win = guardedWindow(false)

    win.close()

    expect(win.destroyed).toBe(true)
    expect(electron.dialog.showMessageBox).not.toHaveBeenCalled()
  })

  it('stays open on Cancel, and asks again next time', async () => {
    const win = guardedWindow(true)
    answer(CANCEL)

    win.close()
    await settled()
    win.close()
    await settled()

    expect(win.destroyed).toBe(false)
    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(2)
  })

  it('closes on Don’t save', async () => {
    const win = guardedWindow(true)
    answer(DISCARD)

    win.close()
    await settled()

    expect(win.destroyed).toBe(true)
    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('saves, then closes, on Save', async () => {
    const win = guardedWindow(true)
    answer(SAVE)
    rendererSaves(win, true)

    win.close()
    await settled()

    expect(win.webContents.send).toHaveBeenCalledWith(CLOSE_GUARD_CHANNELS.saveRequested)
    expect(win.destroyed).toBe(true)
  })

  it('stays open when the save fails or is dismissed', async () => {
    const win = guardedWindow(true)
    answer(SAVE)
    rendererSaves(win, false)

    win.close()
    await settled()

    expect(win.destroyed).toBe(false)
  })

  it('is not left waiting when the renderer goes away during the save', async () => {
    const win = guardedWindow(true)
    answer(SAVE)

    win.close()
    await settled()
    win.webContents.emit('render-process-gone')
    await settled()
    // The first question is over, so this close asks a new one.
    answer(DISCARD)
    win.close()
    await settled()

    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(2)
    expect(win.destroyed).toBe(true)
  })

  it('asks once when a second close arrives while the question is up', async () => {
    const win = guardedWindow(true)
    answer(DISCARD)

    win.close()
    win.close()
    await settled()

    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(1)
    expect(win.destroyed).toBe(true)
  })

  it('quits the app, not just the window, when the close came from a quit', async () => {
    const win = guardedWindow(true)
    answer(DISCARD)

    electron.app.emit('before-quit')
    win.close()
    await settled()

    expect(electron.app.quit).toHaveBeenCalledTimes(1)
  })

  it('forgets a cancelled quit, so a later close only closes the window', async () => {
    const win = guardedWindow(true)
    answer(CANCEL)
    electron.app.emit('before-quit')
    win.close()
    await settled()

    answer(DISCARD)
    win.close()
    await settled()

    expect(electron.app.quit).not.toHaveBeenCalled()
    expect(win.destroyed).toBe(true)
  })

  it('forgets a quit that no window held up', async () => {
    const saved = guardedWindow(false)
    electron.app.emit('before-quit')
    saved.close()

    const win = guardedWindow(true)
    answer(DISCARD)
    win.close()
    await settled()

    expect(electron.app.quit).not.toHaveBeenCalled()
  })

  it('ignores another window’s messages', async () => {
    const win = guardedWindow(true)
    const other = new FakeWindow()
    electron.ipcMain.emit(CLOSE_GUARD_CHANNELS.setUnsaved, { sender: other.webContents }, false)
    answer(CANCEL)

    win.close()
    await settled()

    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(1)
  })
})

describe('settleUnsavedWork', () => {
  it('is true straight away when nothing is unsaved', async () => {
    const win = guardedWindow(false)

    expect(await settleUnsavedWork()).toBe(true)
    expect(electron.dialog.showMessageBox).not.toHaveBeenCalled()
    expect(win.destroyed).toBe(false)
  })

  it('is false on Cancel, and leaves the window open', async () => {
    const win = guardedWindow(true)
    answer(CANCEL)

    expect(await settleUnsavedWork()).toBe(false)
    expect(win.destroyed).toBe(false)
  })

  it('is true once the person agrees, and the window then closes without asking again', async () => {
    const win = guardedWindow(true)
    answer(DISCARD)

    expect(await settleUnsavedWork()).toBe(true)
    win.close()

    expect(win.destroyed).toBe(true)
    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(1)
  })

  it('goes back to asking if the window is still open a while later', async () => {
    vi.useFakeTimers()
    const win = guardedWindow(true)
    answer(DISCARD)
    await settleUnsavedWork()

    vi.advanceTimersByTime(11_000)
    vi.useRealTimers()
    answer(CANCEL)
    win.close()
    await settled()

    expect(win.destroyed).toBe(false)
    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(2)
  })
})
