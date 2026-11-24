/** The file formats a model can be exported in. Also the file extension. */
export type ExportFormat = 'stl' | '3mf'

/** One file in an export of several files to a folder. */
export interface BatchExportFile {
  /** What to call the file, without the extension. The main process makes it safe. */
  name: string
  data: ArrayBuffer
}

/** What an export of several files wrote. On a failure, the files written before it. */
export interface BatchExport {
  directory: string
  /** The file names written, in the order the files were given. */
  files: string[]
}
