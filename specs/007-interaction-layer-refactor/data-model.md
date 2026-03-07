# Data Model: Canvas Interaction Layer Refactor

**Feature Branch**: `007-interaction-layer-refactor`
**Date**: 2026-03-06

## Entity Model Changes

### PolygonEntity (modified semantics, no schema change)

The `PolygonEntity` type definition remains unchanged:

```
PolygonEntity {
  type: 'polygon'
  vertices: Vertex2D[]        // NOW: local-space (relative to transform.position)
  transform: Transform        // NOW: position is the polygon's centroid
  // ... inherited BaseEntity fields
}
```

**Before (v0.3.0)**: `transform.position = (0, 0, 0)`, vertices in world-space
**After (v0.4.0)**: `transform.position = centroid`, vertices offset by `-centroid`

The TypeScript interface does not change — only the semantic meaning of the stored values.

### Invariant (all entity types)

After this change, the following invariant holds for ALL entity types:

- `transform.position` = the visual center of the entity
- Type-specific geometry (diameter, width/height, vertices) is defined relative to `transform.position`
- `entityCenter(entity)` = `entity.transform.position` (no special cases)

## New Shared Types

### EntityBounds

```
EntityBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}
```

Returned by `entityBounds(entity)`. Represents the axis-aligned bounding box in world-space.

### EntityHalfExtents

```
EntityHalfExtents {
  hw: number    // half-width
  hh: number    // half-height
}
```

Returned by `entityHalfExtents(entity)`. For circles, `hw === hh === radius`. For rectangles, `hw = width/2`, `hh = height/2`. For polygons, computed from vertex bounding box.

## Z-Layer Constants

```
Z_LAYERS {
  BACKGROUND_PLANE:    -0.01
  BIN_FILL:            -0.005
  GRID:                 0.0
  BIN_HIT_AREA:         0.001
  BIN_CAPTURE_PLANE:    0.002
  KEEPOUT_OVERLAY:      0.005
  BIN_RESIZE_HANDLE:    0.007
  ENTITY_OUTLINE:       0.01
  TOOL_PREVIEW:         0.02
  SELECTION_BOX:        0.03
  GIZMO_CAPTURE_PLANE:  0.035
  GIZMO_DRAG_HANDLE:    0.04
  GIZMO_CROSS:          0.05
  GIZMO_RESIZE_HANDLE:  0.06
}
```

## Schema Version

**Current**: `0.3.0`
**New**: `0.4.0`

Add `0.4.0` to `SUPPORTED_VERSIONS` array. Migration runs for files with version < `0.4.0`.

## Migration Logic

```
migrate_0_3_to_0_4(project):
  for each entity where type === 'polygon':
    if vertices.length < 3: skip
    centroid = average(vertices)
    entity.transform.position.x += centroid.x
    entity.transform.position.y += centroid.y
    for each vertex in entity.vertices:
      vertex.x -= centroid.x
      vertex.y -= centroid.y
  project.schemaVersion = '0.4.0'
```

This is idempotent: if vertices are already centroid-relative, the computed centroid is (0,0) and no changes occur.

## Affected Files (Geometry Duplication Removal)

Files currently containing inline geometry computation that will be replaced by shared utility calls:

| File | Current Pattern | Replacement |
|------|----------------|-------------|
| `collision.ts` | `getEntityBounds()` inline | `entityBounds()` from shared |
| `snap.ts` | `entityCenterTargets()` inline | `entityCenter()` from shared |
| `entity-shapes.ts` | `entityToVertices()` inline | uses `entityHalfExtents()` |
| `auto-wrap.ts` | `entityHalfExtents()` + `polygonHalfExtents()` inline | `entityHalfExtents()` from shared |
| `TransformGizmo.tsx` | centroid + bounds computed inline | `entityCenter()` + `entityBounds()` |
| `Viewport.tsx` | `entityCenter()` inline helper | `entityCenter()` from shared |
| `LayoutCanvas.tsx` | marquee center-point test inline | `entityBounds()` from shared |
