# Shared Module

This directory contains code shared between the main process, preload, and renderer.

## Directory Structure

```
src/shared/
├── types/           # TypeScript type definitions
│   └── project.ts   # Project data model types
├── schemas/         # JSON schemas for validation
│   └── project.schema.json
└── validation/      # Validation utilities
    ├── project-validator.ts
    └── test-validation.ts
```

## Usage

### Types

Import project types in any layer:

```typescript
import type { ProjectData, Entity, Bin } from '../shared/types/project'
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
