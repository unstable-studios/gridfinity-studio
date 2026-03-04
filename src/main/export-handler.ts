import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
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
