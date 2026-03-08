# Data Model: Layout Engine Abstraction

**Date**: 2026-03-07
**Feature**: 009-layout-engine-abstraction

## Entities

### LayoutShape (discriminated union by `type`)

The canonical shape representation shared between engines and the host app. No engine-specific properties.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | yes | Unique identifier |
| type | `'rect' \| 'circle' \| 'polygon' \| 'svgPath' \| 'meshImport'` | yes | Discriminant |
| x | number | yes | World-space X position (left edge for rect, center for circle/polygon) |
| y | number | yes | World-space Y position (top edge for rect, center for circle/polygon) |
| rotation | number | yes | Rotation in radians, default 0 |
| fill | string | yes | CSS color string |
| stroke | string | yes | CSS color string |
| strokeWidth | number | yes | Stroke width in px |
| groupId | string \| null | yes | Parent group ID, or null if top-level |
| metadata | Record<string, unknown> | no | Extensible metadata (mesh ref, offset tolerance, etc.) |

**Type-specific fields:**

| Type | Additional Fields |
|------|-------------------|
| rect | `width: number`, `height: number`, `cornerRadius?: number` |
| circle | `radius: number` |
| polygon | `points: { x: number; y: number }[]` (vertices relative to position) |
| svgPath | `pathData: string` (SVG path d attribute), `viewBox?: { width: number; height: number }` |
| meshImport | `meshRef: string` (reference to imported file), `silhouettePath?: string` (SVG path for 2D projection) |

### LayoutGroup

Represents a bin containing pocket shapes. Groups can be nested (future-proofing) but MVP is single-level (bin → pockets).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | yes | Unique identifier |
| x | number | yes | World-space X position |
| y | number | yes | World-space Y position |
| width | number | yes | Group bounding width (grid units × baseUnit) |
| height | number | yes | Group bounding height (grid units × baseUnit) |
| rotation | number | yes | Rotation in radians, default 0 |
| childIds | string[] | yes | Ordered list of child LayoutShape IDs |
| style | GroupStyle | yes | Visual style (fill, stroke, cornerRadius) |

### GroupStyle

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fill | string | yes | CSS color for group background |
| stroke | string | yes | CSS color for group border |
| strokeWidth | number | yes | Border width |
| cornerRadius | number | no | Rounded corners |

### LayoutSnapshot

Complete serializable representation of canvas state. Used for project persistence and engine switching.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | string | yes | Snapshot format version (e.g., "1.0.0") |
| shapes | LayoutShape[] | yes | All shapes (including those in groups) |
| groups | LayoutGroup[] | yes | All groups |
| gridConfig | GridConfig | yes | Snapping configuration |

### GridConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| size | number | yes | Grid pitch in px (default: 42, matching Gridfinity baseUnit) |
| enabled | boolean | yes | Whether snap-to-grid is active |
| visible | boolean | yes | Whether grid lines are rendered |

### TransientState

Captured separately for engine switching. Not persisted to project files.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| selectedIds | string[] | yes | Currently selected shape/group IDs |
| viewport | ViewportState | yes | Pan and zoom state |

### ViewportState

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| panX | number | yes | Horizontal pan offset |
| panY | number | yes | Vertical pan offset |
| zoom | number | yes | Zoom level (1.0 = 100%) |

### EngineEvent (discriminated union by `type`)

| Event Type | Payload | Emitted When |
|------------|---------|-------------|
| selectionChanged | `{ ids: string[] }` | Selection changes (click, shift-click, marquee, clear, programmatic) |
| shapeMoved | `{ id: string, x: number, y: number }` | Shape position changed (drag end) |
| shapeResized | `{ id: string, width?: number, height?: number, radius?: number, scaleX?: number, scaleY?: number }` | Shape dimensions changed (transform end) |
| shapeCreated | `{ shape: LayoutShape }` | New shape added to canvas |
| shapeDeleted | `{ id: string }` | Shape removed from canvas |
| groupChanged | `{ groupId: string, childIds: string[] }` | Group membership changed (add/remove children) |
| viewportChanged | `{ panX: number, panY: number, zoom: number }` | Pan or zoom changed |

## Relationships

```
LayoutSnapshot 1──* LayoutShape
LayoutSnapshot 1──* LayoutGroup
LayoutGroup    1──* LayoutShape (via childIds → shape.groupId)
```

- A LayoutShape belongs to zero or one LayoutGroup (via `groupId`).
- A LayoutGroup contains zero or more LayoutShapes (via `childIds`).
- LayoutSnapshot is the root aggregate for serialization.

## Validation Rules

- Shape `id` must be unique across all shapes and groups in a snapshot.
- Group `childIds` must reference existing shape IDs.
- Shape `groupId` must reference an existing group ID or be null.
- `childIds` and `groupId` must be consistent (bidirectional).
- Shape type-specific fields must be present (e.g., rect must have width/height).
- Numeric fields (x, y, width, height, radius, rotation, zoom) must be finite numbers.
- Grid size must be > 0.
