import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectData } from '../shared/types/project'
import type { UpdateState } from '../shared/types/updates'
import type { OperationResult } from '../shared/types/results'
import type { BatchExport, BatchExportFile, ExportFormat } from '../shared/types/export'

interface UpdatesAPI {
  getState: () => Promise<UpdateState>
  onStateChange: (handler: (state: UpdateState) => void) => () => void
  installNow: () => Promise<void>
}

interface CloseGuardAPI {
  setUnsaved: (unsaved: boolean) => void
  onSaveRequested: (save: () => Promise<boolean>) => () => void
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
  stl: (stlData: ArrayBuffer, suggestedName?: string) => Promise<OperationResult<string>>
  threemf: (data: ArrayBuffer, suggestedName?: string) => Promise<OperationResult<string>>
  batch: (files: BatchExportFile[], format: ExportFormat) => Promise<OperationResult<BatchExport>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      project: ProjectAPI
      export: ExportAPI
      updates: UpdatesAPI
      closeGuard: CloseGuardAPI
    }
  }
}
