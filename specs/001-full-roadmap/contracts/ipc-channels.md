# IPC Channel Contracts

**Branch**: `001-full-roadmap` | **Date**: 2026-03-04

All IPC channels follow the existing pattern: registered in main, bridged in preload, consumed in renderer via `window.api.*`. All return `OperationResult<T>`.

## Existing Channels

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `project:save` | renderer → main | `{projectData, filePath?}` | `OperationResult<string>` (saved path) |
| `project:load` | renderer → main | `{filePath?}` | `OperationResult<ProjectData>` |
| `project:validate` | renderer → main | `{projectData}` | `OperationResult<void>` |

## New Channels (by phase)

### Phase 1: Foundation

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `project:new` | renderer → main | `void` | `OperationResult<ProjectData>` |
| `project:get-recent` | renderer → main | `void` | `OperationResult<string[]>` (recent file paths) |

### Phase 4: Import

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `import:svg` | renderer → main | `{filePath?}` | `OperationResult<{pathData: string, filename: string}>` |
| `import:stl` | renderer → main | `{filePath?}` | `OperationResult<{meshData: ArrayBuffer, filename: string}>` |

### Phase 6: Export

| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `export:stl` | renderer → main | `{mesh: ArrayBuffer, filePath?}` | `OperationResult<string>` |
| `export:3mf` | renderer → main | `{mesh: ArrayBuffer, metadata: object, filePath?}` | `OperationResult<string>` |
| `export:batch` | renderer → main | `{items: Array<{mesh: ArrayBuffer, name: string}>, directory?}` | `OperationResult<string[]>` |

## Worker Message Protocol

The geometry worker communicates via `postMessage` / `onmessage` (not IPC).

### Renderer → Worker

```typescript
type WorkerRequest =
  | { type: 'extrude', id: string, polygon: Float32Array, depth: number, direction: 'up' | 'down' }
  | { type: 'boolean', id: string, op: 'union' | 'subtract' | 'intersect', meshA: ArrayBuffer, meshB: ArrayBuffer }
  | { type: 'bake', id: string, binMesh: ArrayBuffer, operations: BooleanOp[] }
  | { type: 'analyze', id: string, mesh: ArrayBuffer, minWall: number, minFloor: number }
```

### Worker → Renderer

```typescript
type WorkerResponse =
  | { type: 'result', id: string, mesh: ArrayBuffer }
  | { type: 'progress', id: string, percent: number, message: string }
  | { type: 'error', id: string, error: string }
  | { type: 'analysis', id: string, warnings: BakeWarning[] }
```
