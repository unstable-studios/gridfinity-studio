import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'

interface ProjectAPI {
  save: (
    projectData: ProjectData,
    filePath?: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>
  load: (filePath?: string) => Promise<{ success: boolean; data?: ProjectData; error?: string }>
  validate: (projectData: unknown) => Promise<{ success: boolean; error?: string }>
  new: () => Promise<{ success: boolean; data?: ProjectData; error?: string }>
  getRecent: () => Promise<{ success: boolean; data?: string[]; error?: string }>
}

interface ExportAPI {
  stl: (stlData: ArrayBuffer) => Promise<{ success: boolean; error?: string; data?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      project: ProjectAPI
      export: ExportAPI
    }
  }
}
