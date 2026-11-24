import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

const dialog = vi.hoisted(() => ({ showOpenDialog: vi.fn(), showMessageBox: vi.fn() }))
vi.mock('electron', () => ({ dialog }))

import { batchFileNames, exportBatch, exportFileName } from '../export-handler'

describe('exportFileName', () => {
  it('uses the suggested name', () => {
    expect(exportFileName('Workbench drawer.3mf', '3mf')).toBe('Workbench drawer.3mf')
  })

  it('adds the extension when it is missing', () => {
    expect(exportFileName('Workbench drawer', 'stl')).toBe('Workbench drawer.stl')
  })

  it('keeps dots inside the name', () => {
    expect(exportFileName('drawer v1.2.stl', 'stl')).toBe('drawer v1.2.stl')
  })

  it('falls back when no name is given', () => {
    expect(exportFileName(undefined, 'stl')).toBe('gridfinity-bin.stl')
    expect(exportFileName('   ', '3mf')).toBe('gridfinity-bin.3mf')
  })

  it('does not double the extension when the name ends in a space or dot', () => {
    expect(exportFileName('drawer.stl ', 'stl')).toBe('drawer.stl')
    expect(exportFileName('drawer.stl.', 'stl')).toBe('drawer.stl')
  })

  it('falls back when the value is not text', () => {
    expect(exportFileName(5, 'stl')).toBe('gridfinity-bin.stl')
    expect(exportFileName({}, 'stl')).toBe('gridfinity-bin.stl')
    expect(exportFileName(null, 'stl')).toBe('gridfinity-bin.stl')
  })

  it('changes a name Windows keeps for a device', () => {
    expect(exportFileName('CON', 'stl')).toBe('CON export.stl')
    expect(exportFileName('lpt1.3mf', '3mf')).toBe('lpt1 export.3mf')
    expect(exportFileName('Console', 'stl')).toBe('Console.stl')
    expect(exportFileName('nul.v2', 'stl')).toBe('nul export.v2.stl')
    expect(exportFileName('COM1.left.3mf', '3mf')).toBe('COM1 export.left.3mf')
  })

  it('shortens a very long name', () => {
    const name = exportFileName('a'.repeat(300), 'stl')
    expect(name).toBe(`${'a'.repeat(120)}.stl`)
  })

  it('takes out invisible characters', () => {
    expect(exportFileName('dra\u200bwer\u202e', 'stl')).toBe('dra wer.stl')
    expect(exportFileName('\u007f', 'stl')).toBe('gridfinity-bin.stl')
  })

  it('takes out folders and characters a file name cannot have', () => {
    expect(exportFileName('../../etc/passwd', 'stl')).toBe('etc passwd.stl')
    expect(exportFileName('C:\\Users\\me\\bin', 'stl')).toBe('C Users me bin.stl')
    expect(exportFileName('what? <bin> "one"', '3mf')).toBe('what bin one.3mf')
  })
})

describe('batchFileNames', () => {
  it('names each file after what it was given', () => {
    expect(batchFileNames(['Pliers', 'Bits'], 'stl')).toEqual(['Pliers.stl', 'Bits.stl'])
  })

  it('numbers names that repeat, whatever their case', () => {
    expect(batchFileNames(['Bin', 'bin', 'Bin'], '3mf')).toEqual([
      'Bin.3mf',
      'bin 2.3mf',
      'Bin 3.3mf'
    ])
  })

  it('does not hand out a numbered name that is already taken', () => {
    expect(batchFileNames(['Bin', 'Bin 2', 'Bin'], 'stl')).toEqual([
      'Bin.stl',
      'Bin 2.stl',
      'Bin 3.stl'
    ])
  })

  it('names a file "Bin" when there is nothing usable', () => {
    expect(batchFileNames(['', '///', 7], 'stl')).toEqual(['Bin.stl', 'Bin 2.stl', 'Bin 3.stl'])
  })

  it('treats two spellings of an accented name as one', () => {
    expect(batchFileNames(['Caf\u00e9', 'Cafe\u0301'], 'stl')).toHaveLength(2)
    expect(batchFileNames(['Caf\u00e9', 'Cafe\u0301'], 'stl')[1]).toBe('Cafe\u0301 2.stl')
  })

  it('keeps every file inside the folder', () => {
    expect(batchFileNames(['../../escape'], 'stl')).toEqual(['escape.stl'])
  })
})

describe('exportBatch', () => {
  const win = {} as BrowserWindow
  const bytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gfstudio-batch-'))
    dialog.showOpenDialog.mockReset().mockResolvedValue({ canceled: false, filePaths: [dir] })
    dialog.showMessageBox.mockReset()
  })

  it('writes one file per entry into the chosen folder', async () => {
    const result = await exportBatch(
      win,
      [
        { name: 'Pliers', data: bytes('one') },
        { name: 'Pliers', data: bytes('two') }
      ],
      'stl'
    )
    expect(result).toEqual({
      success: true,
      data: { directory: dir, files: ['Pliers.stl', 'Pliers 2.stl'] }
    })
    expect(await readFile(join(dir, 'Pliers.stl'), 'utf8')).toBe('one')
    expect(await readFile(join(dir, 'Pliers 2.stl'), 'utf8')).toBe('two')
    expect(dialog.showMessageBox).not.toHaveBeenCalled()
  })

  it('is cancelled when no folder is chosen', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await exportBatch(win, [{ name: 'Pliers', data: bytes('one') }], 'stl')
    expect(result).toEqual({ success: false, reason: 'cancelled' })
  })

  it('asks before replacing a file, and leaves everything alone on Cancel', async () => {
    await writeFile(join(dir, 'Pliers.stl'), 'old')
    dialog.showMessageBox.mockResolvedValue({ response: 1 })
    const result = await exportBatch(
      win,
      [
        { name: 'Bits', data: bytes('new') },
        { name: 'Pliers', data: bytes('new') }
      ],
      'stl'
    )
    expect(result).toEqual({ success: false, reason: 'cancelled' })
    expect(dialog.showMessageBox.mock.calls[0][1].message).toBe(
      `Replace “Pliers.stl” in “${basename(dir)}”?`
    )
    expect(await readdir(dir)).toEqual(['Pliers.stl'])
    expect(await readFile(join(dir, 'Pliers.stl'), 'utf8')).toBe('old')
  })

  it('replaces files once the person agrees', async () => {
    await writeFile(join(dir, 'Pliers.stl'), 'old')
    dialog.showMessageBox.mockResolvedValue({ response: 0 })
    const result = await exportBatch(win, [{ name: 'Pliers', data: bytes('new') }], 'stl')
    expect(result.success).toBe(true)
    expect(await readFile(join(dir, 'Pliers.stl'), 'utf8')).toBe('new')
  })

  it('says which files were written before a failure', async () => {
    // A folder where the second file should go: writing it fails.
    await mkdir(join(dir, 'Bits.stl'))
    dialog.showMessageBox.mockResolvedValue({ response: 0 })
    const result = await exportBatch(
      win,
      [
        { name: 'Pliers', data: bytes('one') },
        { name: 'Bits', data: bytes('two') }
      ],
      'stl'
    )
    expect(result.success).toBe(false)
    expect(result.data).toEqual({ directory: dir, files: ['Pliers.stl'] })
  })

  it('refuses a request that is not files, before asking for a folder', async () => {
    const bad = [
      [null],
      [{ name: 'Pliers', data: 'text' }],
      [{ name: 'Pliers' }],
      'files',
      []
    ] as unknown as Array<Parameters<typeof exportBatch>[1]>
    for (const files of bad) {
      expect((await exportBatch(win, files, 'stl')).success).toBe(false)
    }
    expect(dialog.showOpenDialog).not.toHaveBeenCalled()
  })

  it('reports a failure to write', async () => {
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(dir, 'missing')]
    })
    const result = await exportBatch(win, [{ name: 'Pliers', data: bytes('one') }], 'stl')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ENOENT/)
  })

  it('refuses a format it does not know', async () => {
    const result = await exportBatch(
      win,
      [{ name: 'Pliers', data: bytes('one') }],
      'exe' as unknown as 'stl'
    )
    expect(result.success).toBe(false)
    expect(dialog.showOpenDialog).not.toHaveBeenCalled()
  })
})
