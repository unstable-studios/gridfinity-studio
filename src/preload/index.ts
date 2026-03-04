import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'

// Custom APIs for renderer
const api = {
  project: {
    save: (projectData: ProjectData, filePath?: string) =>
      ipcRenderer.invoke('project:save', projectData, filePath),
    load: (filePath?: string) => ipcRenderer.invoke('project:load', filePath),
    validate: (projectData: unknown) => ipcRenderer.invoke('project:validate', projectData),
    new: () => ipcRenderer.invoke('project:new'),
    getRecent: () => ipcRenderer.invoke('project:get-recent')
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
