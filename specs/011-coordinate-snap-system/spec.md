# 011: Coordinate System Standardization & Smart Snap

**Status**: Draft
**Issue**: #253
**Depends on**: 010-layout-engine-integration (Phase 3 drawing tools)

## Problem

The layout engine currently has a single grid system (42mm Gridfinity module grid) that controls both bin placement and shape snapping. This is wrong for shapes — pocket cutouts and decorative geometry need millimeter-precision placement, not 42mm jumps. The drawing tools work around this by bypassing the engine grid entirely, but this means shapes have no snap at all unless Shift is held.

We need two distinct coordinate systems with independent snap behavior, clear visual representation, and consistent rules across all interaction modes (draw, move, resize, rotate, nudge).

## Design

### Two Coordinate Systems

#### Grid (Gridfinity module grid)
- **Purpose**: Bin placement and sizing
- **Unit**: Always millimeters, derived from `project.gridfinity.baseUnit` (default 42mm)
- **Snap reference**: Lower-left corner of bin groups
- **Visual**: Solid lines (current behavior), major lines at `baseUnit`, subdivision lines at `baseUnit / 4`
- **Code name**: `grid` / `GridConfig`

#### Snap (Design detail grid)
- **Purpose**: Shape placement, drawing, resizing, rotating
- **Unit**: Follows user's preferred display unit (mm or inch)
- **Step sizes**: Two tiers — fine (default) and coarse (Shift held)
- **Snap reference**: Centroid for move/draw, edge/corner for resize, angle for rotate
- **Visual**: Distinct from module grid — dotted or dashed lines, muted color, hidden when zoomed out past a threshold
- **Code name**: `snap` / `SnapConfig`

### Snap Configuration

Stored in **app preferences** (not per-project), with values for both unit systems so switching project units is seamless:

```typescript
interface SnapPreferences {
  mm: { fine: number; coarse: number }   // default: 1mm / 5mm
  inch: { fine: number; coarse: number } // default: 0.1in / 0.5in
  rotateAngle: number                    // default: 15 degrees
}
```

The active snap step is resolved at runtime from the project's unit system + the preference tier.

### Modifier Key Model

| Modifier | Move/Draw | Resize | Rotate |
|----------|-----------|--------|--------|
| None | Fine snap | Free | Free |
| Shift | Coarse snap | Snap to step | Snap to angle |
| Alt/Option | Free (no snap) | Free | Free |

### Absolute Snap (No Relative Offset)

Snap positions are always absolute to the grid origin. If a shape sits at 10.3mm and the user drags it with 1mm snap active, it jumps to 10mm or 11mm — not 10.3 + N. Any off-grid offset from a previous free-move is forgotten.

### Selection Snap Rules

The snap system used depends on what's selected:

| Selection | Snap system | Reference point |
|-----------|-------------|-----------------|
| Single shape | Snap (detail) | Shape centroid |
| Multiple shapes | Snap (detail) | Selection centroid |
| Single bin | Grid (module) | Lower-left corner |
| Multiple bins | Grid (module) | First bin lower-left |
| Mixed (bins + shapes) | Grid (module) | Bin lower-left corner |

The mixed-selection rule ensures shapes inside a bin don't shift relative to the bin when the whole assembly is moved.

### Arrow Key Nudge

- Default: move by fine snap step
- Shift + arrow: move by coarse snap step
- Alt + arrow: move by 1 pixel (screen space)

Nudge respects the same selection snap rules above.

## Visual Grid Rendering

Both grids render simultaneously on canvas:

- **Module grid** (bins): Solid lines, current styling. Major at `baseUnit`, minor at `baseUnit / 4`.
- **Detail grid** (shapes): Dotted or short-dash lines in a contrasting muted color. Rendered at the active fine snap interval.
- **Zoom-adaptive visibility**: Detail grid lines fade out below a minimum screen-pixel spacing (e.g., hide when lines would be < 4px apart). Module grid already has this behavior.
- **Grid origin**: Both grids share the same origin (0, 0).

## Existing Code Impact

### Drawing tools (`DrawingToolLayer.tsx`)
Currently has its own `snapShape()` with hardcoded 1mm fine snap. Replace with snap system that reads from app preferences and respects modifier keys.

### Engine snap handlers
- `fabric-engine.ts` `setupSnapToGrid()`: Currently snaps everything to module grid. Needs to distinguish bins (grid snap) from shapes (detail snap or free).
- `konva-engine.ts` `dragmove`/`dragend`: Same — bins snap to grid, shapes to detail snap.
- Both engines need modifier key awareness (Shift/Alt) during drag.

### App preferences
- `PreferencesModal.tsx`: Add snap configuration UI (fine/coarse steps for mm and inch, rotate angle).
- Need a new preferences store or extend the existing one.

### Engine interface
- `LayoutEngine` interface may need `setSnapConfig()` alongside `setGridConfig()`.
- Or snap can live entirely in the React layer (drawing overlay + move handlers) without the engine knowing about it. TBD based on implementation complexity.

## Future Extensions

### Center snap
Snap shape to the center of its containing bin. Useful for centered pocket cutouts.

### Edge/object snap
Snap to edges or centers of other shapes. Common in CAD tools. Lower priority.

### Resize snap
When resizing a shape, the dragged edge/corner snaps to the detail grid. The anchor point (opposite edge/corner) stays fixed. Activated by holding Shift during resize.

### Rotate snap
Holding Shift while rotating snaps to `rotateAngle` increments (default 15°). The rotation origin is the shape's center.

### User-space grouping (Cmd+G)
Distinct from bin groups (LayoutGroup). User groups:
- Move as a unit, snap by group centroid
- No bin metadata
- Can exist inside bins or free on canvas
- Nesting TBD (groups of groups vs flat)

This requires a new entity type or a flag on LayoutGroup to distinguish user groups from bin groups.

## Non-Goals (This Spec)

- Implementing all snap modes — this spec covers the architecture and the core move/draw snap. Resize snap, rotate snap, center snap, and object snap are future work.
- User-space grouping implementation — architecture only.
- Keyboard shortcut customization — snap uses hardcoded Shift/Alt for now.
