import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'

interface ProjectAPI {
  save: (
    projectData: ProjectData,
    filePath?: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>
  load: (
    filePath?: string
  ) => Promise<{ success: boolean; data?: ProjectData; error?: string }>
  validate: (projectData: unknown) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      project: ProjectAPI
    }
  }
}
