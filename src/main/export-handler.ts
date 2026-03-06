import { dialog } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { BrowserWindow } from 'electron'

/**
 * Result of export operations
 */
export interface ExportResult {
  success: boolean
  error?: string
  data?: string
}

/**
 * A single file in a batch export
 */
export interface BatchExportFile {
  filename: string
  data: ArrayBuffer
}

export interface BatchExportResult {
  success: boolean
  error?: string
  exported: number
  directory?: string
}

/**
 * Export STL binary data to a file via native save dialog
 */
export async function exportSTL(win: BrowserWindow, stlData: ArrayBuffer): Promise<ExportResult> {
  const result = await dialog.showSaveDialog(win, {
    title: 'Export STL',
    defaultPath: 'gridfinity-bin.stl',
    filters: [{ name: 'STL Files', extensions: ['stl'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Export cancelled' }
  }

  try {
    await writeFile(result.filePath, Buffer.from(stlData))
    return { success: true, data: result.filePath }
  } catch (err) {
    return {
      success: false,
      error: `Failed to export STL: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * Export a single 3MF file via native save dialog
 */
export async function export3MF(win: BrowserWindow, data: ArrayBuffer): Promise<ExportResult> {
  const result = await dialog.showSaveDialog(win, {
    title: 'Export 3MF',
    defaultPath: 'gridfinity-bin.3mf',
    filters: [{ name: '3MF Files', extensions: ['3mf'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Export cancelled' }
  }

  try {
    await writeFile(result.filePath, Buffer.from(data))
    return { success: true, data: result.filePath }
  } catch (err) {
    return {
      success: false,
      error: `Failed to export 3MF: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * Batch export multiple files to a directory via native directory dialog
 */
export async function exportBatch(
  win: BrowserWindow,
  files: BatchExportFile[]
): Promise<BatchExportResult> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Export Directory',
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'Export cancelled', exported: 0 }
  }

  const dir = result.filePaths[0]
  let exported = 0

  try {
    await mkdir(dir, { recursive: true })

    for (const file of files) {
      const filePath = join(dir, file.filename)
      await writeFile(filePath, Buffer.from(file.data))
      exported++
    }

    return { success: true, exported, directory: dir }
  } catch (err) {
    return {
      success: false,
      error: `Batch export failed: ${err instanceof Error ? err.message : String(err)}`,
      exported
    }
  }
}
