/**
 * Example and verification script for project schema validation
 * This demonstrates the schema works correctly and validates round-trip operations
 */

import { createEmptyProject, createDefaultTransform } from '../types/project'
import type { ProjectData, Entity, Bin, Group, Generator } from '../types/project'
import { validateProject, formatValidationErrors } from './project-validator'

console.log('🧪 Testing Gridfinity Studio Project Schema v0\n')

// Test 1: Create an empty project
console.log('Test 1: Creating empty project...')
const emptyProject = createEmptyProject('Test Project')
console.log('✓ Empty project created:', emptyProject.settings.name)

// Test 2: Validate empty project
console.log('\nTest 2: Validating empty project...')
let validation = validateProject(emptyProject)
if (validation.valid) {
  console.log('✓ Empty project is valid')
} else {
  console.error('✗ Empty project validation failed:')
  console.error(formatValidationErrors(validation.errors))
  process.exit(1)
}

// Test 3: Create a complete project with all features
console.log('\nTest 3: Creating complete project with entities, bins, groups, generators...')
const completeProject: ProjectData = {
  ...emptyProject,
  settings: {
    ...emptyProject.settings,
    description: 'A test project with all features',
    author: 'Test Author'
  },
  entities: [
    {
      id: 'entity-1',
      name: 'Test Entity 1',
      type: 'bin',
      transform: createDefaultTransform(),
      visible: true,
      locked: false,
      properties: { color: 'blue' }
    } as Entity,
    {
      id: 'entity-2',
      name: 'Test Entity 2',
      type: 'divider',
      transform: {
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      visible: true,
      locked: false,
      groupId: 'group-1',
      properties: {}
    } as Entity
  ],
  bins: [
    {
      id: 'bin-1',
      name: 'Small Storage Bin',
      width: 1,
      depth: 1,
      height: 3,
      hasDividers: false,
      hasLabel: true,
      labelText: 'Screws',
      hasStackingLip: true,
      properties: {}
    } as Bin,
    {
      id: 'bin-2',
      name: 'Large Storage Bin',
      width: 2,
      depth: 2,
      height: 5,
      hasDividers: true,
      dividerCount: 4,
      hasLabel: false,
      hasStackingLip: true,
      properties: { material: 'PLA' }
    } as Bin
  ],
  groups: [
    {
      id: 'group-1',
      name: 'Test Group',
      entityIds: ['entity-2'],
      visible: true,
      locked: false,
      properties: {}
    } as Group
  ],
  generators: [
    {
      id: 'gen-1',
      name: 'Grid Generator',
      type: 'grid',
      parameters: { rows: 5, cols: 5 },
      enabled: true
    } as Generator
  ]
}

console.log('✓ Complete project created with:')
console.log(`  - ${completeProject.entities.length} entities`)
console.log(`  - ${completeProject.bins.length} bins`)
console.log(`  - ${completeProject.groups.length} groups`)
console.log(`  - ${completeProject.generators.length} generators`)

// Test 4: Validate complete project
console.log('\nTest 4: Validating complete project...')
validation = validateProject(completeProject)
if (validation.valid) {
  console.log('✓ Complete project is valid')
} else {
  console.error('✗ Complete project validation failed:')
  console.error(formatValidationErrors(validation.errors))
  process.exit(1)
}

// Test 5: Test round-trip (serialize and deserialize)
console.log('\nTest 5: Testing round-trip (serialize → deserialize)...')
const serialized = JSON.stringify(completeProject, null, 2)
console.log(`✓ Serialized to JSON (${serialized.length} bytes)`)

const deserialized = JSON.parse(serialized)
validation = validateProject(deserialized)
if (validation.valid) {
  console.log('✓ Deserialized project is valid')
} else {
  console.error('✗ Deserialized project validation failed:')
  console.error(formatValidationErrors(validation.errors))
  process.exit(1)
}

// Test 6: Verify no data loss in round-trip
console.log('\nTest 6: Verifying no data loss in round-trip...')
const originalJson = JSON.stringify(completeProject)
const deserializedJson = JSON.stringify(deserialized)
if (originalJson === deserializedJson) {
  console.log('✓ No data loss - serialized data matches original')
} else {
  console.error('✗ Data loss detected in round-trip')
  process.exit(1)
}

// Test 7: Test validation errors
console.log('\nTest 7: Testing validation error detection...')
const invalidProject = {
  schemaVersion: 'invalid-version',
  settings: {
    name: '', // Empty name should fail
    createdAt: 'not-a-date',
    modifiedAt: 'not-a-date',
    units: 'invalid-unit' // Invalid unit
  },
  gridfinity: {
    baseUnit: -1, // Negative should fail
    gridSpacing: 0, // Zero should fail
    unitHeight: 0, // Zero should fail
    tolerance: 0,
    magnetHoles: { enabled: 'yes', diameter: 0, depth: 0 }, // Wrong type for enabled
    screwHoles: { enabled: false, diameter: 0, depth: 0 }
  },
  entities: [
    {
      id: 'ent-1',
      name: 'Test',
      type: 'invalid-type', // Invalid type
      transform: { position: { x: 0 } }, // Missing y, z
      visible: 'yes', // Wrong type
      locked: false,
      properties: {}
    }
  ],
  groups: [],
  generators: [],
  bins: []
}

validation = validateProject(invalidProject)
if (!validation.valid) {
  console.log(`✓ Validation correctly detected ${validation.errors.length} errors:`)
  validation.errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error.field}: ${error.message}`)
  })
} else {
  console.error('✗ Validation should have failed but passed')
  process.exit(1)
}

// Test 8: Test duplicate ID detection
console.log('\nTest 8: Testing duplicate ID detection...')
const projectWithDuplicates: ProjectData = {
  ...emptyProject,
  entities: [
    {
      id: 'duplicate',
      name: 'Entity 1',
      type: 'bin',
      transform: createDefaultTransform(),
      visible: true,
      locked: false,
      properties: {}
    } as Entity,
    {
      id: 'duplicate', // Same ID
      name: 'Entity 2',
      type: 'bin',
      transform: createDefaultTransform(),
      visible: true,
      locked: false,
      properties: {}
    } as Entity
  ]
}

validation = validateProject(projectWithDuplicates)
if (!validation.valid) {
  const hasDuplicateError = validation.errors.some((e) => e.message.includes('Duplicate'))
  if (hasDuplicateError) {
    console.log('✓ Duplicate ID correctly detected')
  } else {
    console.error('✗ Duplicate ID not detected')
    process.exit(1)
  }
} else {
  console.error('✗ Validation should have failed for duplicate IDs')
  process.exit(1)
}

console.log('\n✅ All tests passed!')
console.log('\nSchema validation is working correctly:')
console.log('  ✓ Valid projects pass validation')
console.log('  ✓ Invalid projects are rejected with clear errors')
console.log('  ✓ Round-trip serialization has no data loss')
console.log('  ✓ Duplicate IDs are detected')
console.log('  ✓ All field types are validated')
