/**
 * Test invalid file error handling
 * Run with: npx tsx src/main/test-error-handling.ts
 */

import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { validateProject, formatValidationErrors } from '../shared/validation/project-validator'

console.log('🧪 Testing Error Handling for Invalid Files\n')

// Test 1: Invalid JSON syntax
console.log('Test 1: Invalid JSON syntax...')
const invalidJsonFile = join(tmpdir(), 'invalid-json.gfstudio')
try {
  writeFileSync(invalidJsonFile, '{invalid json content}', 'utf-8')
  
  // Simulate load operation
  const fs = require('fs')
  const fileContent = fs.readFileSync(invalidJsonFile, 'utf-8')
  
  try {
    JSON.parse(fileContent)
    console.error('✗ Should have failed to parse invalid JSON')
    process.exit(1)
  } catch (parseError) {
    const error = parseError as Error
    console.log('✓ Invalid JSON correctly rejected')
    console.log(`  Error: ${error.message}`)
  }
  
  unlinkSync(invalidJsonFile)
} catch (error) {
  console.error('✗ Test setup failed:', error)
  process.exit(1)
}

// Test 2: Missing required fields
console.log('\nTest 2: Missing required fields...')
const missingFieldsProject = {
  schemaVersion: '0.1.0'
  // Missing all other required fields
}

const validation1 = validateProject(missingFieldsProject)
if (validation1.valid) {
  console.error('✗ Should have detected missing required fields')
  process.exit(1)
}
console.log('✓ Missing required fields detected')
console.log(`  Errors: ${validation1.errors.length}`)
validation1.errors.slice(0, 3).forEach((error) => {
  console.log(`  - ${error.field}: ${error.message}`)
})

// Test 3: Invalid schema version format
console.log('\nTest 3: Invalid schema version format...')
const invalidVersionProject = {
  schemaVersion: 'not-a-version',
  settings: {
    name: 'Test',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    units: 'mm' as const
  },
  gridfinity: {
    baseUnit: 42,
    gridSpacing: 42,
    unitHeight: 7,
    tolerance: 0.5,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  },
  entities: [],
  groups: [],
  generators: [],
  bins: []
}

const validation2 = validateProject(invalidVersionProject)
if (validation2.valid) {
  console.error('✗ Should have detected invalid schema version')
  process.exit(1)
}
console.log('✓ Invalid schema version detected')
const versionError = validation2.errors.find((e) => e.field === 'schemaVersion')
console.log(`  Error: ${versionError?.message}`)

// Test 4: Invalid field types
console.log('\nTest 4: Invalid field types...')
const invalidTypesProject = {
  schemaVersion: '0.1.0',
  settings: {
    name: 123, // Should be string
    createdAt: 'not-a-date',
    modifiedAt: 'not-a-date',
    units: 'invalid-unit' // Invalid enum value
  },
  gridfinity: {
    baseUnit: 'not-a-number', // Should be number
    gridSpacing: -1, // Should be positive
    unitHeight: 0, // Should be positive
    tolerance: 0.5,
    magnetHoles: { enabled: 'yes', diameter: 6.5, depth: 2.4 }, // Wrong type
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  },
  entities: [],
  groups: [],
  generators: [],
  bins: []
}

const validation3 = validateProject(invalidTypesProject)
if (validation3.valid) {
  console.error('✗ Should have detected invalid field types')
  process.exit(1)
}
console.log('✓ Invalid field types detected')
console.log(`  Errors: ${validation3.errors.length}`)

// Test 5: Duplicate IDs
console.log('\nTest 5: Duplicate entity IDs...')
const duplicateIdProject = {
  schemaVersion: '0.1.0',
  settings: {
    name: 'Test',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    units: 'mm' as const
  },
  gridfinity: {
    baseUnit: 42,
    gridSpacing: 42,
    unitHeight: 7,
    tolerance: 0.5,
    magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
    screwHoles: { enabled: false, diameter: 3, depth: 6 }
  },
  entities: [
    {
      id: 'duplicate',
      name: 'Entity 1',
      type: 'bin',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      visible: true,
      locked: false,
      properties: {}
    },
    {
      id: 'duplicate', // Same ID
      name: 'Entity 2',
      type: 'bin',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      visible: true,
      locked: false,
      properties: {}
    }
  ],
  groups: [],
  generators: [],
  bins: []
}

const validation4 = validateProject(duplicateIdProject)
if (validation4.valid) {
  console.error('✗ Should have detected duplicate IDs')
  process.exit(1)
}
console.log('✓ Duplicate entity IDs detected')
const duplicateError = validation4.errors.find((e) => e.message.includes('Duplicate'))
console.log(`  Error: ${duplicateError?.message}`)

// Test 6: Format validation errors
console.log('\nTest 6: Error message formatting...')
const formattedError = formatValidationErrors(validation3.errors)
if (!formattedError.includes('Project validation failed:')) {
  console.error('✗ Error formatting failed')
  process.exit(1)
}
console.log('✓ Validation errors formatted correctly')
console.log('  Sample output:')
const lines = formattedError.split('\n').slice(0, 4)
lines.forEach((line) => console.log(`  ${line}`))

console.log('\n✅ All error handling tests passed!')
console.log('\nError handling works correctly:')
console.log('  ✓ Invalid JSON syntax is detected')
console.log('  ✓ Missing required fields are detected')
console.log('  ✓ Invalid schema versions are detected')
console.log('  ✓ Invalid field types are detected')
console.log('  ✓ Duplicate IDs are detected')
console.log('  ✓ Errors are formatted with actionable messages')
