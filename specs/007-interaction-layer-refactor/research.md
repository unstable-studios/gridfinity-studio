# Research: Canvas Interaction Layer Refactor

**Feature Branch**: `007-interaction-layer-refactor`
**Date**: 2026-03-06

## R1: Polygon Vertex Storage Model

**Decision**: Normalize polygon vertices to local-space (centroid-relative) with `transform.position` set to the centroid.

**Rationale**: Currently, `PolygonTool` creates entities with `transform.position = (0, 0, 0)` and vertices in world-space coordinates. This means every consumer that needs the polygon's center, bounds, or snap position must special-case polygons by computing the centroid from vertices + position offset. Circles and rectangles already use `transform.position` as their center with geometry defined relative to it (diameter, width/height). Normalizing polygons to the same convention eliminates 5 known bugs and all special-case code.

**Migration strategy**: On project load, detect polygons with the old representation (heuristic: `transform.position === (0,0,0)` AND vertices exist). Compute centroid, set `transform.position` to centroid, offset all vertices by `-centroid`. Bump schema version from `0.3.0` to `0.4.0`. The migration is lossy only in the sense that old app versions can't open new files — no data is lost.

**Alternatives considered**:
- Keep world-space vertices, add special-case code everywhere → rejected: this is the current state and it's the root cause of 5 bugs
- Store both world and local vertices → rejected: violates YAGNI, creates sync risk

## R2: Shared Geometry Utilities Scope

**Decision**: Create a single `src/shared/geometry/entity-geometry.ts` module with three functions: `entityCenter()`, `entityBounds()`, `entityHalfExtents()`.

**Rationale**: These three computations are duplicated across 6+ files (collision.ts, snap.ts, entity-shapes.ts, auto-wrap.ts, TransformGizmo.tsx, Viewport.tsx). After polygon normalization, the implementations become trivial (just `transform.position` for center, position ± half-extents for bounds). Placing them in `src/shared/` makes them available to both renderer and main process.

**Alternatives considered**:
- Put in `src/renderer/src/lib/` → rejected: would not be accessible to main process if needed for validation
- Create separate functions per entity type → rejected: the whole point is one function that handles the discriminated union

## R3: Z-Layer Architecture

**Decision**: Define z-layer constants in `src/renderer/src/lib/z-layers.ts` as a flat object with named keys.

**Rationale**: 15+ magic z-values are scattered across 10 files. The current z-stack works (no visual bugs) but is fragile and undocumented. A constants module with descriptive names (e.g., `Z.BIN_FILL`, `Z.ENTITY_OUTLINE`, `Z.GIZMO_HANDLE`) makes the ordering explicit and prevents future collisions.

**Current z-stack** (from audit):
```
-0.01   Background click/marquee plane
-0.005  Bin footprint fill
 0.0    Tool capture planes, grid
 0.001  Bin hit area
 0.002  Bin drag capture plane
 0.005  Keep-out overlay
 0.007  Bin resize handles
 0.01   Entity outlines
 0.02   Tool previews, grid overlay
 0.03   Selection box, gizmo capture plane
 0.04   Gizmo drag handle
 0.05   Gizmo cross indicator
 0.06   Gizmo resize handles
```

**Alternatives considered**:
- Enum → rejected: enums don't support decimal values cleanly in TypeScript
- Render order instead of z-position → rejected: r3f's raycaster uses z-distance, so explicit z-values are needed for correct event targeting

## R4: Drag System Consolidation

**Decision**: TransformGizmo is the sole entity drag handler. EntityRenderer handles only click-to-select and hover.

**Rationale**: The current codebase already has this structure — EntityRenderer has no drag logic (only click + hover). The spec's concern about "duplicate drag systems" was based on a patching session where click-to-drag was temporarily added to EntityRenderer. That code was never committed to the branch. TransformGizmo's bounding-box drag plane already covers the "click anywhere on entity to drag" use case because it overlays the selected entity's bounds.

**Key insight**: EntityRenderer's hit areas need to be full-shape fills (not tiny circles) so that clicking anywhere on an entity selects it, which then activates TransformGizmo's drag plane. This is the correct event flow: click → select → gizmo appears → drag via gizmo.

**Alternatives considered**:
- Move all drag logic to EntityRenderer → rejected: breaks multi-select drag (EntityRenderer is per-entity, TransformGizmo handles the group)
- Merge both into a third component → rejected: unnecessary complexity, current split is fine

## R5: Marquee Selection for Polygons

**Decision**: Use bounding-box overlap test instead of center-point containment for marquee selection.

**Rationale**: Current marquee checks if `entity.transform.position` falls within the marquee rectangle. For polygons with position at (0,0,0), this means the marquee must cover the origin to select any polygon. After normalization (R1), position will be the centroid, but bounding-box overlap is still more intuitive — a polygon partially inside the marquee should be selected.

**Alternatives considered**:
- Center-point test after normalization → acceptable but less intuitive for large shapes
- Full shape intersection test → rejected: overkill, AABB overlap is standard in 2D editors

## R6: Project File Migration

**Decision**: Add migration function in the project loader that runs when `schemaVersion < 0.4.0`. Bump version to `0.4.0`.

**Rationale**: The validator already supports version checking (`SUPPORTED_VERSIONS` array in project.ts). Migration needs to:
1. Find all polygon entities
2. Compute centroid from vertices
3. Set `transform.position` to centroid
4. Offset vertices by `-centroid`
5. Update schemaVersion to `0.4.0`

This is a data-only migration with no UI impact. The migration is idempotent (running it on already-migrated data is a no-op since centroid of local-space vertices is (0,0)).

**Alternatives considered**:
- Lazy migration (migrate on first access) → rejected: complicates every consumer
- No migration (break old files) → rejected: unacceptable UX
