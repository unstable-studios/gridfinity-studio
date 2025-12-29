import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
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
 * Save project to file
 */
export async function saveProject(
  projectData: ProjectData,
  filePath?: string
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
        defaultPath: `${projectData.settings.name}.gfstudio`,
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
export async function loadProject(filePath?: string): Promise<OperationResult<ProjectData>> {
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

    return {
      success: true,
      data: projectData as ProjectData
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
