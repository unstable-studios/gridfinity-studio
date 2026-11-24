import { useProject } from './useProject'

const FALLBACK = 'Untitled project'

/** Name of a project file without its folder or extension. */
export function projectNameFromPath(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath
  return fileName.replace(/\.gfstudio$/i, '')
}

/**
 * The name shown for the open project and used for its exports: the saved file's name, or
 * the name given when the project was created if it has not been saved yet.
 */
export function useProjectName(): string {
  const filePath = useProject((s) => s.filePath)
  const givenName = useProject((s) => s.project?.settings.name)
  if (filePath) return projectNameFromPath(filePath)
  return givenName?.trim() || FALLBACK
}
