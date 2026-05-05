import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'
import type { UpdateState } from '../shared/types/updates'

interface UpdatesAPI {
  getState: () => Promise<UpdateState>
  onStateChange: (handler: (state: UpdateState) => void) => () => void
  installNow: () => Promise<void>
}

interface ProjectAPI {
  save: (
    projectData: ProjectData,
    filePath?: string,
    suggestedPath?: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>
  load: (filePath?: string) => Promise<{
    success: boolean
    data?: { project: ProjectData; filePath: string }
    error?: string
  }>
  validate: (projectData: unknown) => Promise<{ success: boolean; error?: string }>
  new: () => Promise<{ success: boolean; data?: ProjectData; error?: string }>
  getRecent: () => Promise<{ success: boolean; data?: string[]; error?: string }>
}

interface ExportAPI {
  stl: (stlData: ArrayBuffer) => Promise<{ success: boolean; error?: string; data?: string }>
  threemf: (data: ArrayBuffer) => Promise<{ success: boolean; error?: string; data?: string }>
  batch: (
    files: Array<{ filename: string; data: ArrayBuffer }>
  ) => Promise<{ success: boolean; error?: string; exported: number; directory?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      project: ProjectAPI
      export: ExportAPI
      updates: UpdatesAPI
    }
  }
}
