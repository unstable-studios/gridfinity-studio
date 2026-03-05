# Snap System — Detailed Specification

## Status

**Current state**: Minimal snap system in `src/renderer/src/lib/snap.ts` — snaps to nearest grid intersection and entity centers/edges. Single threshold, no per-axis snapping, no alignment guides, only works on entity centroids.

**Target state**: Full multi-layer snap system with independent X/Y axis snapping, alignment guides, multiple snap point sources per dragged object, visual feedback, and user-configurable toggles.

## Snap Layers

Each layer is independently toggleable. When multiple layers produce candidates on the same axis, the closest wins.

### 1. Gridfinity Grid Snap

Snap to the 42mm Gridfinity base grid — the grid that bins occupy.

- **Targets**: Lines at `x = n * baseUnit` and `y = n * baseUnit` (not just intersections)
- **Snap points on dragged object**: Center, edges, corners
- **Axis-independent**: X snaps to vertical grid lines, Y snaps to horizontal grid lines, independently
- **Use case**: Aligning entities to bin boundaries

### 2. Unit Grid Snap (Sub-grid)

Snap to a finer subdivision grid for precision placement.

- **Grid size**: User-configurable (e.g., 1mm, 5mm, 10mm, half-baseUnit)
- **Targets**: Lines at `x = n * unitSize` and `y = n * unitSize`
- **Snap points on dragged object**: Same as Gridfinity grid
- **Use case**: Precise fractional placement within a grid cell

### 3. Object Snap (Point-to-Point)

Snap dragged object's anchor points to other objects' anchor points.

- **Snap points on dragged object**: Center, edge midpoints, corners (type-dependent)
- **Snap targets on other objects**:
  - **Rectangle**: Center, 4 edge midpoints, 4 corners
  - **Circle**: Center, 4 cardinal points (N/S/E/W)
  - **Polygon**: Center (centroid), vertices, edge midpoints
- **Excluded**: The dragged entity itself (already fixed in current code)
- **Use case**: Centering a circle on a rectangle's corner, aligning edges

### 4. Alignment Snap (Axis Guides)

Snap to align with other objects on the same horizontal or vertical axis. This is NOT point-to-point — it activates when any snap point on the dragged object shares an X or Y coordinate with any snap point on another object.

- **Behavior**: When dragged object's snap point is within threshold of another object's snap point on ONE axis, snap that axis only
- **Visual feedback**: Dashed guide line drawn between the aligned points
- **Snap points**: Same anchor points as object snap
- **Examples**:
  - Two rectangles with their top edges on the same Y → horizontal guide line
  - Circle center aligned with rectangle center on X → vertical guide line
  - Rectangle left edge aligned with another rectangle's right edge → vertical guide line
- **Use case**: Lining up objects in rows/columns without them needing to be at exact grid positions

### 5. Bin Edge Snap

Snap to bin footprint boundaries.

- **Targets**: Bin edges (left, right, top, bottom of each bin footprint)
- **Snap points on dragged object**: Center, edges, corners
- **Use case**: Placing entities flush against bin walls

## Architecture

### Snap Resolution Pipeline

```
DragEvent (cursor position)
    │
    ├── Compute snap points on dragged object(s)
    │   (center, edges, corners — based on entity type and selection bbox)
    │
    ├── For each snap point, for each enabled layer:
    │   ├── Generate candidates { axis: 'x'|'y', value: number, distance: number }
    │   └── Filter by threshold (screen-space pixels, not world units)
    │
    ├── Per-axis: pick closest candidate across all snap points and layers
    │   → bestSnapX: { value, guide? } | null
    │   → bestSnapY: { value, guide? } | null
    │
    ├── Apply: offset dragged position by (bestSnapX delta, bestSnapY delta)
    │
    └── Return: { position, guides[] } for rendering alignment lines
```

### Key Design Decisions

1. **Per-axis snapping**: X and Y snap independently. Current system snaps to the nearest point (Euclidean distance), which means you can only snap near grid intersections. Per-axis snapping lets you snap X to a grid line while Y follows the cursor freely.

2. **Screen-space threshold**: Threshold should be in screen pixels (e.g., 8px), not world units. At high zoom, 5mm is huge on screen; at low zoom, it's invisible. Screen-space threshold gives consistent UX across zoom levels.

3. **Multiple snap points per object**: When dragging a rectangle, its center, edges, AND corners are all potential snap sources. The system checks all of them and picks the closest match per axis.

4. **Snap result includes guides**: The snap function returns both the snapped position AND guide line data for rendering visual feedback (alignment lines).

5. **Priority**: When candidates from different layers are equidistant, priority order: Object snap > Alignment snap > Gridfinity grid > Unit grid. (Explicit object relationships beat implicit grid.)

### Snap Point Extraction

```ts
interface SnapPoint {
  x: number
  y: number
  label: 'center' | 'edge-n' | 'edge-s' | 'edge-e' | 'edge-w' | 'corner-ne' | 'corner-nw' | 'corner-se' | 'corner-sw' | 'vertex'
}

function getSnapPoints(entity: Entity): SnapPoint[]
function getSelectionSnapPoints(entities: Entity[]): SnapPoint[]  // bbox-based for multi-select
```

### Snap Configuration

```ts
interface SnapConfig {
  enabled: boolean                    // Global toggle (keyboard shortcut to toggle)
  gridfinityGrid: boolean             // Snap to 42mm grid
  unitGrid: { enabled: boolean; size: number }  // Sub-grid
  objectSnap: boolean                 // Point-to-point
  alignmentSnap: boolean              // Axis alignment guides
  binEdgeSnap: boolean                // Bin boundaries
  threshold: number                   // Screen-space pixels (default: 8)
}
```

Stored in project settings or user preferences. Toggleable via toolbar buttons or keyboard shortcuts.

### Visual Feedback

- **Snap indicator**: Small dot or crosshair at the active snap point
- **Alignment guide**: Dashed line from snapped point to the reference point, with distance label
- **Grid highlight**: Subtle highlight on the grid line being snapped to
- **Snap type indicator**: Different colors per layer (e.g., blue for grid, orange for object, green for alignment)

## Integration Points

- **TransformGizmo**: Entity drag (centroid move)
- **TransformGizmo resize handles**: Edge/corner snapping during resize
- **BinDragHandler**: Bin drag (already snaps to grid, needs alignment)
- **Primitive tools** (circle, rectangle, polygon): Snap during placement
- **Future**: Rotation snap (15° increments, align to other object angles)

## Files

| File | Role |
|------|------|
| `src/renderer/src/lib/snap.ts` | Core snap resolution engine (rewrite) |
| `src/renderer/src/hooks/useSnapping.ts` | React hook wrapping snap config + state |
| `src/renderer/src/components/layout/SnapGuides.tsx` | New — renders alignment guide lines |
| `src/renderer/src/components/layout/SnapToolbar.tsx` | New — snap toggle buttons in toolbar |
| `src/renderer/src/components/layout/TransformGizmo.tsx` | Consumer — drag + resize |
| `src/renderer/src/components/layout/LayoutCanvas.tsx` | Consumer — bin drag, tool placement |

## Tasks (to be integrated into tasks.md)

- [ ] **SNAP-01**: Refactor snap engine for per-axis resolution with multi-point sources
- [ ] **SNAP-02**: Implement screen-space threshold (requires camera zoom context)
- [ ] **SNAP-03**: Add alignment snap layer with guide line data
- [ ] **SNAP-04**: Add bin edge snap layer
- [ ] **SNAP-05**: Implement snap point extraction for all entity types
- [ ] **SNAP-06**: Render alignment guide lines (SnapGuides component)
- [ ] **SNAP-07**: Add snap configuration UI (toolbar toggles + preferences)
- [ ] **SNAP-08**: Integrate snap into resize handles
- [ ] **SNAP-09**: Integrate snap into primitive tool placement
- [ ] **SNAP-10**: Add keyboard shortcut to toggle snap (e.g., hold Ctrl to temporarily disable)
