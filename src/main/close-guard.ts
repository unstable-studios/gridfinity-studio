import { app, dialog, ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { CLOSE_GUARD_CHANNELS } from '../shared/types/close-guard'

/** The three answers, in the order the buttons are shown. */
const SAVE = 0
const DISCARD = 1
const CANCEL = 2

/**
 * What to do once the person has dealt with their unsaved work. Closing the window is the
 * default. Quitting and installing an update set their own, so the app carries on with what
 * was asked for instead of only closing the window.
 */
let afterClose: (() => void) | null = null

/** Run `action` in place of a plain close the next time unsaved work has been dealt with. */
export function continueWith(action: () => void): void {
  afterClose = action
}

// Cmd+Q, the app menu and the dock all arrive here before the windows are asked to close.
app.on('before-quit', () => continueWith(() => app.quit()))

/** Ask the renderer to save, and wait to hear whether it worked. */
function saveInRenderer(win: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const onResult = (event: Electron.IpcMainEvent, saved: boolean): void => {
      if (event.sender !== win.webContents) return
      ipcMain.off(CLOSE_GUARD_CHANNELS.saveResult, onResult)
      resolve(saved === true)
    }
    ipcMain.on(CLOSE_GUARD_CHANNELS.saveResult, onResult)
    win.webContents.send(CLOSE_GUARD_CHANNELS.saveRequested)
  })
}

/**
 * Stop `win` from closing with unsaved work until the person has chosen to save it, drop it
 * or stay. The renderer says whether there is unsaved work; it is the only one that knows.
 */
export function guardUnsavedWork(win: BrowserWindow): void {
  let unsaved = false
  let asking = false
  let closing = false

  const onUnsaved = (event: Electron.IpcMainEvent, value: boolean): void => {
    if (event.sender === win.webContents) unsaved = value === true
  }
  ipcMain.on(CLOSE_GUARD_CHANNELS.setUnsaved, onUnsaved)
  win.on('closed', () => ipcMain.off(CLOSE_GUARD_CHANNELS.setUnsaved, onUnsaved))

  win.on('close', (event) => {
    if (closing || !unsaved) {
      afterClose = null
      return
    }
    event.preventDefault()
    if (asking) return
    asking = true

    void (async () => {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        message: 'Save your changes?',
        detail: 'Changes you don’t save are lost.',
        buttons: ['Save', 'Don’t save', 'Cancel'],
        defaultId: SAVE,
        cancelId: CANCEL
      })
      const proceed = response === DISCARD || (response === SAVE && (await saveInRenderer(win)))
      asking = false
      const next = afterClose
      afterClose = null
      // Cancel, or a save that failed or was dismissed: stay open, and forget the quit.
      if (!proceed || win.isDestroyed()) return
      closing = true
      if (next) next()
      else win.close()
    })()
  })
}
