import { app, dialog, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { CLOSE_GUARD_CHANNELS } from '../shared/types/close-guard'

/** The three answers, in the order the buttons are shown. */
const SAVE = 0
const DISCARD = 1
const CANCEL = 2

/**
 * How long a window stays free to close after the person has agreed to it. Long enough for a
 * quit or an update install to go through. If that never happens, the window goes back to
 * asking, so work done afterwards is not lost.
 */
const AGREED_FOR_MS = 10_000

interface Guard {
  /** Ask about unsaved work if there is any. Resolves to whether the window may close. */
  settle: () => Promise<boolean>
}

const guards = new Map<BrowserWindow, Guard>()

/**
 * True from a request to quit until the windows have answered it. A window that holds the
 * quit up for unsaved work quits the app afterwards, instead of only closing itself.
 */
let quitRequested = false

// Cmd+Q, the app menu and the dock all arrive here before the windows are asked to close.
app.on('before-quit', () => {
  quitRequested = true
})

/**
 * Deal with unsaved work in every window, asking where there is some. Resolves to true when
 * every window may close.
 *
 * Call this before anything that closes the windows without giving them a say. Installing an
 * update is one: on Windows and Linux the installer starts, and stops the app, before a
 * window's close event could ask.
 */
export async function settleUnsavedWork(): Promise<boolean> {
  for (const guard of [...guards.values()]) {
    if (!(await guard.settle())) return false
  }
  return true
}

/**
 * Ask the renderer to save, and wait to hear whether it worked. A renderer that crashes,
 * reloads or goes away while saving counts as not saved, so the window is never left waiting.
 */
function saveInRenderer(win: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const contents = win.webContents
    const finish = (saved: boolean): void => {
      ipcMain.off(CLOSE_GUARD_CHANNELS.saveResult, onResult)
      contents.off('render-process-gone', onGone)
      contents.off('destroyed', onGone)
      contents.off('did-start-navigation', onNavigation)
      resolve(saved)
    }
    const onResult = (event: Electron.IpcMainEvent, saved: boolean): void => {
      if (event.sender === contents) finish(saved === true)
    }
    const onGone = (): void => finish(false)
    const onNavigation = (
      details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>
    ): void => {
      if (details.isMainFrame && !details.isSameDocument) finish(false)
    }
    ipcMain.on(CLOSE_GUARD_CHANNELS.saveResult, onResult)
    contents.once('render-process-gone', onGone)
    contents.once('destroyed', onGone)
    contents.on('did-start-navigation', onNavigation)
    contents.send(CLOSE_GUARD_CHANNELS.saveRequested)
  })
}

/**
 * Stop `win` from closing with unsaved work until the person has chosen to save it, drop it
 * or stay. The renderer says whether there is unsaved work; it is the only one that knows.
 */
export function guardUnsavedWork(win: BrowserWindow): void {
  let unsaved = false
  /** The person has agreed to this window closing, for a short while. */
  let agreed = false
  /** The question on screen now, so a second request joins it instead of asking twice. */
  let asking: Promise<boolean> | null = null

  const onUnsaved = (event: Electron.IpcMainEvent, value: boolean): void => {
    if (event.sender === win.webContents) unsaved = value === true
  }
  ipcMain.on(CLOSE_GUARD_CHANNELS.setUnsaved, onUnsaved)

  const ask = async (): Promise<boolean> => {
    // A minimized window would show the question where nobody can see it.
    if (win.isMinimized()) win.restore()
    win.show()
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      message: 'Save your changes?',
      detail: 'Changes you don’t save are lost.',
      buttons: ['Save', 'Don’t save', 'Cancel'],
      defaultId: SAVE,
      cancelId: CANCEL,
      // Plain buttons on Windows, where the first two would otherwise be drawn as links.
      noLink: true
    })
    if (response === DISCARD) return true
    // A crashed renderer can't save. Staying open is the only way not to lose the work.
    if (response !== SAVE || win.isDestroyed() || win.webContents.isCrashed()) return false
    return saveInRenderer(win)
  }

  const settle = (): Promise<boolean> => {
    if (agreed || !unsaved || win.isDestroyed()) return Promise.resolve(true)
    asking ??= ask().then((mayClose) => {
      asking = null
      if (mayClose) {
        agreed = true
        setTimeout(() => {
          agreed = false
        }, AGREED_FOR_MS).unref()
      }
      return mayClose
    })
    return asking
  }

  guards.set(win, { settle })
  win.on('closed', () => {
    guards.delete(win)
    ipcMain.off(CLOSE_GUARD_CHANNELS.setUnsaved, onUnsaved)
  })

  win.on('close', (event) => {
    if (agreed || !unsaved) {
      quitRequested = false
      return
    }
    // Holding the window open also calls off a quit. Remember it was one.
    event.preventDefault()
    const quitting = quitRequested
    quitRequested = false
    const alreadyAsking = asking !== null
    void settle().then((mayClose) => {
      // A close that arrived while the question was up has nothing of its own to carry out.
      if (!mayClose || alreadyAsking || win.isDestroyed()) return
      if (quitting) app.quit()
      else win.close()
    })
  })
}
