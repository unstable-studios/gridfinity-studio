import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'
import { UPDATE_CHANNELS, type UpdateState } from '../shared/types/updates'
import { CLOSE_GUARD_CHANNELS } from '../shared/types/close-guard'
import type { BatchExportFile, ExportFormat } from '../shared/types/export'

// Custom APIs for renderer
const api = {
  project: {
    save: (projectData: ProjectData, filePath?: string, suggestedPath?: string) =>
      ipcRenderer.invoke('project:save', projectData, filePath, suggestedPath),
    load: (filePath?: string) => ipcRenderer.invoke('project:load', filePath),
    validate: (projectData: unknown) => ipcRenderer.invoke('project:validate', projectData),
    new: () => ipcRenderer.invoke('project:new'),
    getRecent: () => ipcRenderer.invoke('project:get-recent')
  },
  export: {
    stl: (stlData: ArrayBuffer, suggestedName?: string) =>
      ipcRenderer.invoke('export:stl', stlData, suggestedName),
    threemf: (data: ArrayBuffer, suggestedName?: string) =>
      ipcRenderer.invoke('export:3mf', data, suggestedName),
    batch: (files: BatchExportFile[], format: ExportFormat) =>
      ipcRenderer.invoke('export:batch', files, format)
  },
  closeGuard: {
    /** Tell the main process whether closing the window would lose work. */
    setUnsaved: (unsaved: boolean): void =>
      ipcRenderer.send(CLOSE_GUARD_CHANNELS.setUnsaved, unsaved),
    /**
     * Register what saves the project when the person chooses Save on the way out. It
     * resolves to whether the save succeeded. Returns an unsubscribe function.
     */
    onSaveRequested: (save: () => Promise<boolean>): (() => void) => {
      const listener = (): void => {
        void save()
          .catch(() => false)
          .then((saved) => ipcRenderer.send(CLOSE_GUARD_CHANNELS.saveResult, saved))
      }
      ipcRenderer.on(CLOSE_GUARD_CHANNELS.saveRequested, listener)
      return () => ipcRenderer.off(CLOSE_GUARD_CHANNELS.saveRequested, listener)
    }
  },
  updates: {
    /** Read the current update state (renderer may mount after main has emitted). */
    getState: (): Promise<UpdateState> => ipcRenderer.invoke(UPDATE_CHANNELS.getState),
    /** Subscribe to state changes. Returns an unsubscribe function. */
    onStateChange: (handler: (state: UpdateState) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, state: UpdateState): void => handler(state)
      ipcRenderer.on(UPDATE_CHANNELS.state, listener)
      return () => ipcRenderer.off(UPDATE_CHANNELS.state, listener)
    },
    /** Quit and install the downloaded update. Only meaningful when state is 'downloaded'. */
    installNow: (): Promise<void> => ipcRenderer.invoke(UPDATE_CHANNELS.installNow)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
