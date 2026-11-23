import { describe, it, expect } from 'vitest'
import { describeFileError, fileName } from '../file-errors'

describe('describeFileError', () => {
  it.each([
    ["EACCES: permission denied, open '/x/a.gfstudio'", /permission/],
    ["EPERM: operation not permitted, open 'C:\\\\x'", /permission/],
    ['EROFS: read-only file system', /permission/],
    ['ENOSPC: no space left on device, write', /disk is full/],
    ["ENOENT: no such file or directory, open '/gone/a.stl'", /no longer exists/],
    ['EISDIR: illegal operation on a directory, read', /folder/],
    ['EBUSY: resource busy or locked', /in use/]
  ])('explains %s', (detail, expected) => {
    expect(describeFileError(detail)).toMatch(expected)
  })

  it('never shows a raw error code for a known failure', () => {
    expect(describeFileError('EACCES: permission denied')).not.toMatch(/EACCES/)
  })

  it('keeps the detail when the failure is not recognized', () => {
    expect(describeFileError('socket hang up')).toBe('Try again. Details: socket hang up')
  })

  it('still says what to do with no detail at all', () => {
    expect(describeFileError(undefined)).toBe('Try again.')
  })
})

describe('fileName', () => {
  it('handles both path separators', () => {
    expect(fileName('/Users/me/bins/tray.3mf')).toBe('tray.3mf')
    expect(fileName('C:\\Users\\me\\tray.stl')).toBe('tray.stl')
    expect(fileName('tray.stl')).toBe('tray.stl')
  })
})
