import { app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { readFileSync, writeFileSync } from 'fs'
import { createEmptyProject } from '../shared/types/project'
import type { ProjectData } from '../shared/types/project'
import { validateProject, formatValidationErrors } from '../shared/validation/project-validator'

/**
 * Result of save/load operations
 */
interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Maximum number of recent project paths to track
 */
const MAX_RECENT_PROJECTS = 10

/**
 * Persist recent project paths to a JSON file in the app's userData directory.
 */
import { join } from 'path'

const recentFilePath = join(app.getPath('userData'), 'recent-projects.json')

function loadRecentFromDisk(): string[] {
  try {
    const data = readFileSync(recentFilePath, 'utf-8')
    const parsed: unknown = JSON.parse(data)
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
      return parsed as string[]
    }
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
  }
  return []
}

function saveRecentToDisk(paths: string[]): void {
  try {
    writeFileSync(recentFilePath, JSON.stringify(paths), 'utf-8')
  } catch {
    // Best-effort — don't crash if userData is unwritable
  }
}

let recentProjectPaths: string[] = loadRecentFromDisk()

/**
 * Add a file path to the recent projects list
 * Deduplicates and caps at MAX_RECENT_PROJECTS
 */
function addToRecentProjects(filePath: string): void {
  recentProjectPaths = [filePath, ...recentProjectPaths.filter((p) => p !== filePath)].slice(
    0,
    MAX_RECENT_PROJECTS
  )
  saveRecentToDisk(recentProjectPaths)
}

/**
 * Create a new empty project
 */
export function newProject(): OperationResult<ProjectData> {
  return {
    success: true,
    data: createEmptyProject()
  }
}

/**
 * Get the list of recently opened/saved project file paths
 */
export function getRecentProjects(): OperationResult<string[]> {
  return {
    success: true,
    data: [...recentProjectPaths]
  }
}

/**
 * Save project to file
 */
export async function saveProject(
  projectData: ProjectData,
  filePath?: string,
  suggestedPath?: string
): Promise<OperationResult<string>> {
  try {
    // Validate project data before saving
    const validationResult = validateProject(projectData)
    if (!validationResult.valid) {
      return {
        success: false,
        error: formatValidationErrors(validationResult.errors)
      }
    }

    // If no file path provided, show save dialog
    let targetPath = filePath
    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: suggestedPath ?? `${projectData.settings.name}.gfstudio`,
        filters: [
          { name: 'Gridfinity Studio Project', extensions: ['gfstudio'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          error: 'Save operation cancelled'
        }
      }

      targetPath = result.filePath
    }

    // Update modified timestamp
    const dataToSave: ProjectData = {
      ...projectData,
      settings: {
        ...projectData.settings,
        modifiedAt: new Date().toISOString()
      }
    }

    // Write to file
    await writeFile(targetPath, JSON.stringify(dataToSave, null, 2), 'utf-8')

    addToRecentProjects(targetPath)

    return {
      success: true,
      data: targetPath
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to save project: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Load project from file
 */
export async function loadProject(
  filePath?: string
): Promise<OperationResult<{ project: ProjectData; filePath: string }>> {
  try {
    // If no file path provided, show open dialog
    let targetPath = filePath
    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        title: 'Open Project',
        filters: [
          { name: 'Gridfinity Studio Project', extensions: ['gfstudio'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return {
          success: false,
          error: 'Open operation cancelled'
        }
      }

      targetPath = result.filePaths[0]
    }

    // Read file
    const fileContent = await readFile(targetPath, 'utf-8')

    // Parse JSON
    let projectData: unknown
    try {
      projectData = JSON.parse(fileContent)
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      }
    }

    // Validate project data
    const validationResult = validateProject(projectData)
    if (!validationResult.valid) {
      return {
        success: false,
        error: formatValidationErrors(validationResult.errors)
      }
    }

    addToRecentProjects(targetPath)

    return {
      success: true,
      data: { project: projectData as ProjectData, filePath: targetPath }
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to load project: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Validate project data
 */
export function validateProjectData(projectData: unknown): OperationResult {
  const validationResult = validateProject(projectData)

  if (!validationResult.valid) {
    return {
      success: false,
      error: formatValidationErrors(validationResult.errors)
    }
  }

  return {
    success: true
  }
}
