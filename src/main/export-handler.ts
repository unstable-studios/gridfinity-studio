import { dialog } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { BrowserWindow } from 'electron'
import type { FailureReason, OperationResult } from '../shared/types/results'

/**
 * Result of export operations
 */
export type ExportResult = OperationResult<string>

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
  reason?: FailureReason
  exported: number
  directory?: string
}

/** Names Windows keeps for devices. A file can't have one, with or without an extension. */
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Longest name offered, without the extension. File systems stop at 255 bytes. */
const MAX_NAME_LENGTH = 120

/**
 * File name to offer in the save dialog. `suggestedName` comes from the renderer, so anything
 * that could point at another folder or is not allowed in a file name is taken out.
 */
export function exportFileName(suggestedName: unknown, extension: string): string {
  const given = typeof suggestedName === 'string' ? suggestedName : ''
  const clean = (text: string): string =>
    text
      // Path separators, characters Windows refuses, control and invisible characters.
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
  const withoutExtension = clean(given).replace(new RegExp(`\\.${extension}$`, 'i'), '')
  let name = clean(withoutExtension).slice(0, MAX_NAME_LENGTH).trim()
  if (WINDOWS_RESERVED_NAME.test(name)) name = `${name} export`
  return `${name || 'gridfinity-bin'}.${extension}`
}

/**
 * Export STL binary data to a file via native save dialog
 */
export async function exportSTL(
  win: BrowserWindow,
  stlData: ArrayBuffer,
  suggestedName?: string
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog(win, {
    title: 'Export STL',
    defaultPath: exportFileName(suggestedName, 'stl'),
    filters: [{ name: 'STL files', extensions: ['stl'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, reason: 'cancelled' }
  }

  try {
    await writeFile(result.filePath, Buffer.from(stlData))
    return { success: true, data: result.filePath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Export a single 3MF file via native save dialog
 */
export async function export3MF(
  win: BrowserWindow,
  data: ArrayBuffer,
  suggestedName?: string
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog(win, {
    title: 'Export 3MF',
    defaultPath: exportFileName(suggestedName, '3mf'),
    filters: [{ name: '3MF files', extensions: ['3mf'] }]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, reason: 'cancelled' }
  }

  try {
    await writeFile(result.filePath, Buffer.from(data))
    return { success: true, data: result.filePath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
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
    title: 'Choose export folder',
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, reason: 'cancelled', exported: 0 }
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
      error: err instanceof Error ? err.message : String(err),
      exported
    }
  }
}
