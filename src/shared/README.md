# Shared Module

This directory contains code shared between the main process, preload, and renderer.

## Directory Structure

```
src/shared/
├── types/           # Types used by more than one process
│   ├── project.ts   # The project file: settings, Gridfinity config, layout snapshot
│   ├── results.ts   # OperationResult, returned by every IPC handler
│   ├── export.ts    # Export formats and folder exports
│   ├── worker.ts    # Messages to and from the geometry worker
│   └── ...
└── validation/
    ├── project-validator.ts  # Checks a project when it is opened or saved
    └── migrations.ts         # Converts older project files to the current schema
```

## Usage

### Types

Import project types in any layer:

```typescript
import type { ProjectData, LayoutShapeData } from '../shared/types/project'
import { createEmptyProject, CURRENT_SCHEMA_VERSION } from '../shared/types/project'
```

### Validation

Validate project data:

```typescript
import { validateProject, formatValidationErrors } from '../shared/validation/project-validator'

const result = validateProject(projectData)
if (!result.valid) {
  console.error(formatValidationErrors(result.errors))
}
```

## Import Paths

From each layer:

- **Main process**: `import { ... } from '../shared/types/project'`
- **Preload**: `import { ... } from '../shared/types/project'`
- **Renderer**: `import { ... } from '../../../shared/types/project'`

## Why Shared?

Sharing type definitions ensures:

- Single source of truth for data structures
- Type safety across IPC boundaries
- Consistent validation in main and renderer
- No duplicate code maintenance
