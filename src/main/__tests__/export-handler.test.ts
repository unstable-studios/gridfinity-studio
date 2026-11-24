import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ dialog: {} }))

import { exportFileName } from '../export-handler'

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
