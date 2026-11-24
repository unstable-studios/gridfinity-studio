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

  it('takes out folders and characters a file name cannot have', () => {
    expect(exportFileName('../../etc/passwd', 'stl')).toBe('etc passwd.stl')
    expect(exportFileName('C:\\Users\\me\\bin', 'stl')).toBe('C Users me bin.stl')
    expect(exportFileName('what? <bin> "one"', '3mf')).toBe('what bin one.3mf')
  })
})
