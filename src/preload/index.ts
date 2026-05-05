import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'
import { UPDATE_CHANNELS, type UpdateState } from '../shared/types/updates'

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
    stl: (stlData: ArrayBuffer) => ipcRenderer.invoke('export:stl', stlData),
    threemf: (data: ArrayBuffer) => ipcRenderer.invoke('export:3mf', data),
    batch: (files: Array<{ filename: string; data: ArrayBuffer }>) =>
      ipcRenderer.invoke('export:batch', files)
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
