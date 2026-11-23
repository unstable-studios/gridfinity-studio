/**
 * Turn the detail of a failed file operation into a sentence that says what
 * went wrong and what to do. `detail` is the underlying message from the
 * main process, usually a Node file-system error such as
 * "EACCES: permission denied, open '/path'".
 */
export function describeFileError(detail: string | undefined): string {
  const code = detail?.match(/\b(EACCES|EPERM|EROFS|ENOSPC|ENOENT|EISDIR|EBUSY)\b/)?.[1]
  switch (code) {
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return 'You don’t have permission to use that location. Choose another folder.'
    case 'ENOSPC':
      return 'The disk is full. Free some space, then try again.'
    case 'ENOENT':
      return 'That file or folder no longer exists.'
    case 'EISDIR':
      return 'That is a folder. Choose a file.'
    case 'EBUSY':
      return 'The file is in use by another app. Close it there, then try again.'
    default:
      return detail ? `Try again. Details: ${detail}` : 'Try again.'
  }
}

/** Last path segment, for either separator. */
export function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}
