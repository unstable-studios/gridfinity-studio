# Project Schema v0 - Documentation

## Overview

This document describes the canonical project data model for Gridfinity Studio, implemented as a versioned JSON schema. The schema serves as the single source of truth for project layout, entities, generators, and bins.

## Schema Version

Current version: `0.1.0`

The schema follows semantic versioning (semver) for compatibility tracking and future migrations.

## File Format

Gridfinity Studio projects are saved with the `.gfstudio` extension and use JSON format internally.

## Data Structure

### Top-Level Structure

```typescript
interface ProjectData {
  schemaVersion: string         // Schema version (e.g., "0.1.0")
  settings: GlobalSettings       // Global project settings
  gridfinity: GridfinityConfig  // Gridfinity-specific configuration
  entities: Entity[]            // Scene entities (bins, dividers, etc.)
  groups: Group[]              // Entity grouping
  generators: Generator[]       // Procedural content generators
  bins: Bin[]                  // Bin configurations
}
```

### Global Settings

Project metadata and preferences:

- `name` - Project name (required)
- `description` - Optional project description
- `author` - Optional author name
- `createdAt` - Creation timestamp (ISO 8601)
- `modifiedAt` - Last modification timestamp (ISO 8601)
- `units` - Measurement units (`mm`, `cm`, or `in`)

### Gridfinity Configuration

Standard Gridfinity parameters:

- `baseUnit` - Base unit size (default: 42mm)
- `gridSpacing` - Grid spacing between units
- `unitHeight` - Height of a single unit (default: 7mm)
- `tolerance` - Fitting tolerance in mm
- `magnetHoles` - Magnet hole configuration (enabled, diameter, depth)
- `screwHoles` - Screw hole configuration (enabled, diameter, depth)

### Entities

Scene entities represent individual objects:

- `id` - Unique identifier
- `name` - Display name
- `type` - Entity type (`bin`, `divider`, `label`, `custom`)
- `transform` - 3D transformation (position, rotation, scale)
- `visible` - Visibility flag
- `locked` - Lock flag (prevents editing)
- `groupId` - Optional parent group ID
- `properties` - Custom properties object

### Groups

Organize related entities:

- `id` - Unique identifier
- `name` - Group name
- `entityIds` - Array of entity IDs in this group
- `visible` - Group visibility
- `locked` - Group lock status
- `properties` - Custom properties

### Generators

Procedural content generation:

- `id` - Unique identifier
- `name` - Generator name
- `type` - Generator type (`grid`, `pattern`, `array`, `custom`)
- `parameters` - Type-specific parameters
- `target` - Optional target entity/template
- `enabled` - Enable/disable flag

### Bins

Gridfinity bin configurations:

- `id` - Unique identifier
- `name` - Bin name
- `width`, `depth`, `height` - Dimensions in Gridfinity units
- `hasDividers` - Enable dividers
- `dividerCount` - Number of dividers (if enabled)
- `hasLabel` - Enable label area
- `labelText` - Label text (if enabled)
- `hasStackingLip` - Enable stacking lip
- `properties` - Custom properties

## Validation

The schema includes comprehensive validation:

- **Required fields** - All mandatory fields must be present
- **Type checking** - Values must match their expected types
- **Value constraints** - Numeric values have min/max constraints
- **Unique IDs** - All IDs must be unique within their collection
- **Enum validation** - Enum fields must use allowed values
- **Format validation** - Dates must be ISO 8601, versions must be semver

### Validation Errors

Validation errors include:
- `field` - The path to the invalid field
- `message` - Human-readable error description
- `value` - The invalid value (optional)

## API Usage

### Renderer (React)

```typescript
// Save project
const result = await window.api.project.save(projectData, filePath)
if (result.success) {
  console.log('Saved to:', result.data)
} else {
  console.error('Save failed:', result.error)
}

// Load project
const result = await window.api.project.load(filePath)
if (result.success) {
  const project = result.data
  // Use project data
} else {
  console.error('Load failed:', result.error)
}

// Validate project
const result = await window.api.project.validate(projectData)
if (!result.success) {
  console.error('Validation failed:', result.error)
}
```

### Creating Projects

```typescript
import { createEmptyProject } from '@/shared/types/project'

// Create new project with defaults
const newProject = createEmptyProject('My Project')
```

## Round-Trip Guarantee

The schema guarantees no data loss during save/load cycles:

1. Valid project data can be serialized to JSON
2. JSON can be parsed back to project data
3. The deserialized data matches the original exactly
4. Validation passes on both original and deserialized data

## File Dialogs

The application provides native file dialogs for save/load operations:

**Save Dialog:**
- Default extension: `.gfstudio`
- Fallback: `.json`
- Automatically updates `modifiedAt` timestamp

**Load Dialog:**
- Accepts: `.gfstudio`, `.json`, and all files
- Validates on load with clear error messages
- Rejects invalid projects before loading

## Example Project

```json
{
  "schemaVersion": "0.1.0",
  "settings": {
    "name": "Small Parts Organizer",
    "description": "Storage for screws and fasteners",
    "author": "John Doe",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "modifiedAt": "2024-01-15T14:45:00.000Z",
    "units": "mm"
  },
  "gridfinity": {
    "baseUnit": 42,
    "gridSpacing": 42,
    "unitHeight": 7,
    "tolerance": 0.5,
    "magnetHoles": {
      "enabled": true,
      "diameter": 6.5,
      "depth": 2.4
    },
    "screwHoles": {
      "enabled": false,
      "diameter": 3,
      "depth": 6
    }
  },
  "entities": [
    {
      "id": "entity-1",
      "name": "Main Bin",
      "type": "bin",
      "transform": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 }
      },
      "visible": true,
      "locked": false,
      "properties": {}
    }
  ],
  "groups": [],
  "generators": [],
  "bins": [
    {
      "id": "bin-1",
      "name": "Small Storage",
      "width": 1,
      "depth": 1,
      "height": 3,
      "hasDividers": false,
      "hasLabel": true,
      "labelText": "M3 Screws",
      "hasStackingLip": true,
      "properties": {}
    }
  ]
}
```

## Implementation Files

- **Types**: `src/shared/types/project.ts` - TypeScript interfaces and utilities
- **Schema**: `src/shared/schemas/project.schema.json` - JSON Schema definition
- **Validation**: `src/shared/validation/project-validator.ts` - Validation logic
- **IPC Handlers**: `src/main/project-handler.ts` - File system operations
- **Preload API**: `src/preload/index.ts` - Renderer API exposure

## Future Enhancements

Potential future additions (not in v0):

- Schema migration utilities for version upgrades
- Import/export from other formats (STEP, STL metadata)
- Compression for large projects
- Incremental save (change tracking)
- Project templates library
- Collaborative editing metadata
