# Data Model: Full Implementation Roadmap

**Branch**: `001-full-roadmap` | **Date**: 2026-03-04

## Existing Entities (already in project.ts)

The canonical schema at `src/shared/types/project.ts` already defines:

- **ProjectData**: Root object (schemaVersion, globalSettings, gridfinityConfig, entities, groups, generators, bins)
- **Entity**: id, name, type, transform, visible, locked, groupId
- **Bin**: id, name, widthUnits, depthUnits, heightUnits, dividers, labels, stackingLip
- **Generator**: id, name, type, config, sourceEntityId
- **Group**: id, name, entityIds
- **GridfinityConfig**: baseUnit (42mm), gridSpacing, unitHeight, tolerance, magnetHoles, screwHoles
- **Transform**: position {x,y,z}, rotation {x,y,z}, scale {x,y,z}

## New/Extended Entities Required

### Entity Type Extensions

The existing `Entity` type needs extended variants for new primitive types:

```
CircleEntity extends Entity
  type: 'circle'
  diameter: number (mm)

RectangleEntity extends Entity
  type: 'rectangle'
  width: number (mm)
  height: number (mm)
  cornerRadius?: number (mm)

PolygonEntity extends Entity
  type: 'polygon'
  vertices: Array<{x: number, y: number}>

SvgRegionEntity extends Entity
  type: 'svg-region'
  pathData: string (SVG d-attribute)
  sourceFile?: string (original filename)

MeshEntity extends Entity
  type: 'mesh'
  sourceFile: string (STL filename)
  meshData?: ArrayBuffer (inline binary, for portability)
```

### Extrusion Parameters

```
ExtrusionConfig
  entityId: string (source 2D entity)
  depth: number (mm)
  direction: 'up' | 'down'
  role: 'solid' | 'cutter'
```

Attach to Entity as optional `extrusion?: ExtrusionConfig` field, or as a separate collection on ProjectData.

### Pattern/Generator Extensions

The existing `Generator` type needs concrete config shapes:

```
LinearPatternConfig
  axis: 'x' | 'y'
  count: number
  spacingMode: 'constant-pitch' | 'size-aware' | 'explicit'
  constantPitch?: number (mm, for constant-pitch mode)
  gap?: number (mm, for size-aware mode)
  positions?: number[] (mm, for explicit mode)

Generator.config: LinearPatternConfig | GridPatternConfig | ...
```

### Undo/Redo (runtime only, not persisted)

```
UndoCommand
  id: string
  label: string (human-readable, e.g., "Move Rectangle")
  execute(): void
  undo(): void

UndoStack
  past: UndoCommand[]
  future: UndoCommand[]
  maxDepth: number (default 100)
```

### Bake State (runtime, not persisted in project file)

```
BakeResult
  binId: string
  mesh: BufferGeometry (Three.js)
  timestamp: number
  dirty: boolean (true if source entities changed since bake)
  warnings: BakeWarning[]

BakeWarning
  type: 'thin-wall' | 'thin-floor' | 'non-manifold' | 'outside-bounds'
  message: string
  location?: {x, y, z}
```

### Export Configuration

```
ExportOptions
  format: 'stl' | '3mf'
  selection: 'all' | 'selected' | string[] (bin IDs)
  filenamePattern: string (e.g., '{project}-{bin}-{index}')
```

## Relationships

```
ProjectData
  ├── entities[] ──── Entity (circle | rectangle | polygon | svg-region | mesh)
  │                    └── extrusion? ── ExtrusionConfig (solid or cutter)
  ├── groups[] ────── Group
  │                    └── entityIds[] → Entity.id
  ├── generators[] ── Generator
  │                    ├── sourceEntityId → Entity.id
  │                    └── config: LinearPatternConfig
  ├── bins[] ──────── Bin
  │                    └── entityIds[] → Entity.id (contents of this bin)
  └── gridfinityConfig ── GridfinityConfig (shared dimensions)
```

## Validation Rules (additions to existing validator)

- Entity `diameter` MUST be > 0 for circles
- Entity `width` and `height` MUST be > 0 for rectangles
- Polygon `vertices` MUST have >= 3 points
- Polygon vertices MUST form a simple (non-self-intersecting) ring
- SVG `pathData` MUST be a valid SVG path d-attribute
- Extrusion `depth` MUST be > 0
- Generator `count` MUST be >= 1
- Pattern `constantPitch` MUST be > 0 when spacingMode is 'constant-pitch'
- Pattern `positions` length MUST equal `count` when spacingMode is 'explicit'
- Bin `entityIds` MUST reference existing entity IDs
- No circular group references (group containing itself)

## Schema Migration Notes

Adding new entity types and the `extrusion` field to Entity is backward-compatible — existing projects without these fields will load correctly (optional fields default to undefined). Schema version should bump to 0.2.0 when these types are implemented.
