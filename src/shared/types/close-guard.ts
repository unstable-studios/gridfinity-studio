/** IPC channels for asking about unsaved work before a window closes. */
export const CLOSE_GUARD_CHANNELS = {
  /** Renderer to main: whether the window has work that closing would lose. */
  setUnsaved: 'window:set-unsaved',
  /** Main to renderer: save the project now. */
  saveRequested: 'window:save-before-close',
  /** Renderer to main: whether that save succeeded. */
  saveResult: 'window:save-before-close-result'
} as const
