import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'
import type { UpdateState } from '../shared/types/updates'
import type { FailureReason, OperationResult } from '../shared/types/results'

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
  ) => Promise<OperationResult<string>>
  load: (filePath?: string) => Promise<OperationResult<{ project: ProjectData; filePath: string }>>
  validate: (projectData: unknown) => Promise<OperationResult>
  new: () => Promise<OperationResult<ProjectData>>
  getRecent: () => Promise<OperationResult<string[]>>
}

interface ExportAPI {
  stl: (stlData: ArrayBuffer) => Promise<OperationResult<string>>
  threemf: (data: ArrayBuffer) => Promise<OperationResult<string>>
  batch: (files: Array<{ filename: string; data: ArrayBuffer }>) => Promise<{
    success: boolean
    error?: string
    reason?: FailureReason
    exported: number
    directory?: string
  }>
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
