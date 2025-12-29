/**
 * Test to verify asset references persist in project files
 * Run with: npx tsx src/main/test-asset-references.ts
 */

import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createEmptyProject, createDefaultTransform } from '../shared/types/project'
import { validateProject, formatValidationErrors } from '../shared/validation/project-validator'
import type { ProjectData, Entity } from '../shared/types/project'

console.log('🧪 Testing Asset Reference Persistence\n')

// Create a project with entities that reference asset files
console.log('Test 1: Creating project with asset references...')
const project = createEmptyProject('Asset Reference Test')

// Add entities with asset path references in properties
const entity1: Entity = {
  id: 'entity-1',
  name: 'Imported SVG Shape',
  type: 'custom',
  transform: createDefaultTransform(),
  visible: true,
  locked: false,
  properties: {
    assetType: 'svg',
    assetPath: '/path/to/imported/shape.svg',
    importedAt: new Date().toISOString(),
    originalDimensions: { width: 100, height: 100 }
  }
}

const entity2: Entity = {
  id: 'entity-2',
  name: 'Imported STL Model',
  type: 'custom',
  transform: createDefaultTransform(),
  visible: true,
  locked: false,
  properties: {
    assetType: 'stl',
    assetPath: '/path/to/imported/model.stl',
    importedAt: new Date().toISOString(),
    fileSize: 1024000,
    vertexCount: 5000
  }
}

project.entities.push(entity1, entity2)
console.log('✓ Project created with 2 entities containing asset references')

// Validate project
console.log('\nTest 2: Validating project with asset references...')
const validation = validateProject(project)
if (!validation.valid) {
  console.error('✗ Project validation failed:')
  console.error(formatValidationErrors(validation.errors))
  process.exit(1)
}
console.log('✓ Project with asset references is valid')

// Save project
const tempFile = join(tmpdir(), 'test-asset-project.gfstudio')
console.log(`\nTest 3: Saving project with asset references to ${tempFile}...`)
try {
  writeFileSync(tempFile, JSON.stringify(project, null, 2), 'utf-8')
  console.log('✓ Project saved successfully')
} catch (error) {
  console.error('✗ Failed to save project:', error)
  process.exit(1)
}

// Load project
console.log('\nTest 4: Loading project from file...')
let loadedProject: ProjectData
try {
  const fileContent = readFileSync(tempFile, 'utf-8')
  loadedProject = JSON.parse(fileContent)
  console.log('✓ Project loaded successfully')
} catch (error) {
  console.error('✗ Failed to load project:', error)
  process.exit(1)
}

// Validate loaded project
console.log('\nTest 5: Validating loaded project...')
const loadedValidation = validateProject(loadedProject)
if (!loadedValidation.valid) {
  console.error('✗ Loaded project validation failed:')
  console.error(formatValidationErrors(loadedValidation.errors))
  process.exit(1)
}
console.log('✓ Loaded project is valid')

// Verify asset references persisted
console.log('\nTest 6: Verifying asset references persisted...')

if (loadedProject.entities.length !== 2) {
  console.error('✗ Expected 2 entities, got', loadedProject.entities.length)
  process.exit(1)
}

const loadedEntity1 = loadedProject.entities[0]
const loadedEntity2 = loadedProject.entities[1]

// Check SVG entity
if (loadedEntity1.properties.assetType !== 'svg') {
  console.error('✗ Entity 1 asset type mismatch')
  process.exit(1)
}
if (loadedEntity1.properties.assetPath !== '/path/to/imported/shape.svg') {
  console.error('✗ Entity 1 asset path not persisted')
  process.exit(1)
}
console.log('✓ SVG asset reference persisted correctly')
console.log(`  - Type: ${loadedEntity1.properties.assetType}`)
console.log(`  - Path: ${loadedEntity1.properties.assetPath}`)

// Check STL entity
if (loadedEntity2.properties.assetType !== 'stl') {
  console.error('✗ Entity 2 asset type mismatch')
  process.exit(1)
}
if (loadedEntity2.properties.assetPath !== '/path/to/imported/model.stl') {
  console.error('✗ Entity 2 asset path not persisted')
  process.exit(1)
}
if (loadedEntity2.properties.fileSize !== 1024000) {
  console.error('✗ Entity 2 file size not persisted')
  process.exit(1)
}
console.log('✓ STL asset reference persisted correctly')
console.log(`  - Type: ${loadedEntity2.properties.assetType}`)
console.log(`  - Path: ${loadedEntity2.properties.assetPath}`)
console.log(`  - File size: ${loadedEntity2.properties.fileSize} bytes`)

// Verify all custom properties persisted
console.log('\nTest 7: Verifying all custom properties persisted...')
const entity1Props = loadedEntity1.properties as Record<string, unknown>
const entity2Props = loadedEntity2.properties as Record<string, unknown>

if (!entity1Props.importedAt || !entity1Props.originalDimensions) {
  console.error('✗ Entity 1 custom properties not fully persisted')
  process.exit(1)
}

if (!entity2Props.importedAt || !entity2Props.vertexCount) {
  console.error('✗ Entity 2 custom properties not fully persisted')
  process.exit(1)
}

console.log('✓ All custom properties persisted')
console.log(`  - Entity 1: ${Object.keys(entity1Props).length} properties`)
console.log(`  - Entity 2: ${Object.keys(entity2Props).length} properties`)

// Cleanup
console.log('\nTest 8: Cleaning up...')
try {
  unlinkSync(tempFile)
  console.log('✓ Temp files cleaned up')
} catch (error) {
  console.warn('⚠ Failed to cleanup temp files:', error)
}

console.log('\n✅ All asset reference tests passed!')
console.log('\nAsset references work correctly:')
console.log('  ✓ Asset paths can be stored in entity properties')
console.log('  ✓ SVG references persist through save/load')
console.log('  ✓ STL references persist through save/load')
console.log('  ✓ All custom metadata persists')
console.log('  ✓ Project with assets validates correctly')
