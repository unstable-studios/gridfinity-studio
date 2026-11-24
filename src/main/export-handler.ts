import { dialog } from 'electron'
import { access, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import type { BrowserWindow } from 'electron'
import type { OperationResult } from '../shared/types/results'
import type { BatchExport, BatchExportFile, ExportFormat } from '../shared/types/export'

/**
 * Result of export operations
 */
export type ExportResult = OperationResult<string>

/** Result of exporting several files to a folder. */
export type BatchExportResult = OperationResult<BatchExport>

/** Names Windows keeps for devices. A file can't have one, with or without an extension. */
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Longest name offered, without the extension. File systems stop at 255 bytes. */
const MAX_NAME_LENGTH = 120

/**
 * File name to offer in the save dialog. `suggestedName` comes from the renderer, so anything
 * that could point at another folder or is not allowed in a file name is taken out.
 * `fallback` is the name used when nothing is left.
 */
export function exportFileName(
  suggestedName: unknown,
  extension: string,
  fallback = 'gridfinity-bin'
): string {
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
  return `${name || fallback}.${extension}`
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
 * File names for a folder of exports, one per given name and in the same order. Each is made
 * safe as `exportFileName` does. A name that is already taken gets a number, so no file
 * replaces another: "Bin", "Bin 2", "Bin 3". Case is ignored, as most file systems do.
 */
export function batchFileNames(names: unknown[], extension: string): string[] {
  const taken = new Set<string>()
  return names.map((given) => {
    const first = exportFileName(given, extension, 'Bin')
    const stem = first.slice(0, -(extension.length + 1))
    let name = first
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${stem} ${n}.${extension}`
    taken.add(name.toLowerCase())
    return name
  })
}

const EXPORT_FORMATS: readonly ExportFormat[] = ['stl', '3mf']

/** At most this many file names are listed when asking to replace files. */
const NAMES_LISTED = 5

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Export several files to a folder the person chooses, each named after `file.name`.
 * Asks before replacing files that are already there.
 */
export async function exportBatch(
  win: BrowserWindow,
  files: BatchExportFile[],
  format: ExportFormat
): Promise<BatchExportResult> {
  if (!EXPORT_FORMATS.includes(format) || !Array.isArray(files) || files.length === 0) {
    return { success: false, error: 'Nothing to export' }
  }

  const result = await dialog.showOpenDialog(win, {
    title: 'Export to folder',
    buttonLabel: 'Export',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, reason: 'cancelled' }
  }

  const directory = result.filePaths[0]
  const names = batchFileNames(
    files.map((file) => file.name),
    format
  )

  const present = await Promise.all(names.map((name) => exists(join(directory, name))))
  const replaced = names.filter((_, i) => present[i])
  if (replaced.length > 0) {
    const listed = replaced.slice(0, NAMES_LISTED).join('\n')
    const more = replaced.length - NAMES_LISTED
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      message:
        replaced.length === 1
          ? `Replace “${replaced[0]}” in “${basename(directory)}”?`
          : `Replace ${replaced.length} files in “${basename(directory)}”?`,
      detail:
        (replaced.length === 1 ? '' : `${listed}${more > 0 ? `\nand ${more} more` : ''}\n\n`) +
        'This can’t be undone.',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (answer.response !== 0) return { success: false, reason: 'cancelled' }
  }

  try {
    for (const [i, file] of files.entries()) {
      await writeFile(join(directory, names[i]), Buffer.from(file.data))
    }
    return { success: true, data: { directory, files: names } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
