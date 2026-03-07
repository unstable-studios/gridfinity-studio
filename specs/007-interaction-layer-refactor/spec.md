# Feature Specification: Canvas Interaction Layer Refactor

**Feature Branch**: `007-interaction-layer-refactor`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Canvas Interaction Layer Refactor — Normalize entity geometry representation, extract shared geometry utilities, consolidate pointer event handling, create z-layer constants, fix polygon bugs, remove duplicate entity drag systems, and add project file migration for existing polygon data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Polygon Behavior (Priority: P1)

A user creates polygon shapes on the canvas and expects them to behave identically to circles and rectangles: they can be selected, dragged, snapped to grid, marquee-selected, and assigned to bins. Currently, polygons store vertices in world-space with a zero-origin position, causing broken drag, snap, marquee selection, and bin ownership.

**Why this priority**: Polygons are fundamentally broken — five separate bugs stem from the inconsistent data representation. This blocks SVG import (which produces polygon-type entities) and makes the existing polygon tool unreliable.

**Independent Test**: Create a polygon on the canvas. Verify it can be: (1) clicked and selected, (2) dragged to a new position with the gizmo following its true center, (3) snapped to the grid, (4) captured by marquee selection, (5) correctly assigned to the bin it lands in.

**Acceptance Scenarios**:

1. **Given** an existing project with polygon entities saved in the old format, **When** the user opens the project, **Then** polygon vertices are automatically migrated to local-space (centroid-relative) representation and the project renders correctly.
2. **Given** a polygon on the canvas, **When** the user drags it, **Then** the polygon moves by the exact drag delta without any double-offset or drift.
3. **Given** a polygon on the canvas near a grid line, **When** the user drags it with snapping enabled, **Then** snap aligns to the polygon's centroid, not to (0,0).
4. **Given** multiple entities including polygons, **When** the user draws a marquee rectangle, **Then** any polygon whose bounding box overlaps the marquee is included in the selection.
5. **Given** a polygon dragged over a bin, **When** the drag ends, **Then** bin ownership is determined by the polygon's actual centroid, not its transform.position origin.

---

### User Story 2 - Single, Predictable Drag System (Priority: P1)

A user selects one or more entities and drags them. There is exactly one drag interaction path: click the entity or its gizmo, drag, release. The drag respects shift-axis-locking, snapping, and multi-selection. There is no competing drag handler that fights for pointer events.

**Why this priority**: Two duplicate drag systems (EntityRenderer click-to-drag and TransformGizmo bounding-box drag) currently compete at the same z-layer, causing unpredictable behavior — sometimes drags are lost, sometimes both fire.

**Independent Test**: Select an entity, drag it. Verify smooth movement, correct snap behavior, and no pointer event conflicts. Repeat with multi-selection.

**Acceptance Scenarios**:

1. **Given** a selected entity, **When** the user clicks and drags anywhere on its shape, **Then** the entity moves smoothly with a single drag handler active.
2. **Given** multiple selected entities, **When** the user drags from any selected entity, **Then** all selected entities move together.
3. **Given** a selected entity with resize handles visible, **When** the user clicks a resize handle, **Then** the resize interaction takes priority over drag.
4. **Given** overlapping entities and bins, **When** the user interacts with them, **Then** pointer events are dispatched to the correct layer based on a well-defined z-ordering.

---

### User Story 3 - Shared Geometry Utilities (Priority: P2)

All parts of the application that need to compute entity centers, bounding boxes, or half-extents use the same shared utility functions. When a new entity type is added (e.g., SVG regions, meshes), geometry computations are added in one place and work everywhere.

**Why this priority**: Entity geometry logic is currently duplicated across 8+ files with inconsistent polygon handling. Each duplicate is a potential bug source and increases the cost of adding new entity types.

**Independent Test**: Verify that all canvas interactions (drag, snap, marquee, bin ownership, gizmo positioning) route through the shared utilities rather than inline computations.

**Acceptance Scenarios**:

1. **Given** a circle, rectangle, or polygon entity, **When** any system needs its center point, **Then** a single shared function computes it correctly for all types.
2. **Given** a circle, rectangle, or polygon entity, **When** any system needs its bounding box, **Then** a single shared function computes it correctly for all types.
3. **Given** a new entity type is added in the future, **When** geometry functions are updated in the shared module, **Then** all consumers (gizmo, marquee, snap, bin ownership) automatically support the new type.

---

### User Story 4 - Deterministic Z-Layer Ordering (Priority: P2)

Interactive elements on the canvas (grid, bin footprints, entity fills, entity outlines, gizmo controls, drag capture planes) render and receive pointer events at well-defined z-depths. There are no z-fighting artifacts, and pointer events always reach the intended target.

**Why this priority**: Multiple invisible capture planes currently render at the same z-depth (0.03), causing event conflicts. Z-values are magic numbers scattered across files.

**Independent Test**: Inspect the z-positions of all canvas elements and verify they follow a documented ordering. Interact with overlapping elements and confirm correct event targeting.

**Acceptance Scenarios**:

1. **Given** entities, bins, and gizmo controls overlapping on the canvas, **When** the user clicks, **Then** the topmost interactive element in the z-order receives the event.
2. **Given** a drag is in progress, **When** a capture plane is active, **Then** it sits at a z-depth above all interactive content to reliably capture pointer movement.
3. **Given** the z-layer constants module, **When** a developer adds a new canvas element, **Then** they can reference named constants rather than guessing magic numbers.

---

### User Story 5 - Visual Feedback for Entities (Priority: P3)

Entities on the canvas have subtle fill colors that change based on interaction state (default, hovered, selected, colliding). Shapes are easy to click because their entire filled area is interactive, not just their outline.

**Why this priority**: This is visual polish that improves usability. The filled hit areas are a prerequisite for the single drag system (Story 2) but the specific opacity values and hover colors are lower priority.

**Independent Test**: Hover over entities and verify visual state changes. Click inside a shape (not on its outline) and verify it selects.

**Acceptance Scenarios**:

1. **Given** an entity on the canvas, **When** the user hovers over it, **Then** its fill opacity increases and its outline color changes to indicate hover.
2. **Given** a selected entity, **When** rendered, **Then** its fill and outline reflect the selected state distinctly from hover.
3. **Given** any entity type, **When** the user clicks anywhere inside its filled area, **Then** the click registers as a selection.

---

### User Story 6 - Interaction Manager Abstraction (Priority: P4 — blocked by Stories 1-5)

Each category of interactive canvas object (entities, bins) has a dedicated interaction manager that owns all pointer event handling for that category: selection, drag, resize, hover. Components become purely visual renderers that receive props and display geometry — they do not contain pointer logic. This eliminates the current pattern of interaction code being split across EntityRenderer, TransformGizmo, and BinDragHandler with duplicated state and competing event handlers.

**Why this priority**: This is the architectural end-state that Stories 1-5 build toward. It cannot be started until the data model is normalized (Story 1), the duplicate drag system is removed (Story 2), shared geometry exists (Story 3), and z-layers are defined (Story 4). It is explicitly blocked, not just lower priority.

**Blocked by**: Stories 1, 2, 3, 4

**Independent Test**: Verify that EntityRenderer and BinFootprint contain zero pointer event handlers or drag state. All interaction logic lives in dedicated manager components that delegate to shared utilities for geometry and z-layer constants.

**Acceptance Scenarios**:

1. **Given** the entity interaction manager, **When** the user clicks, drags, or hovers over any entity type, **Then** all pointer logic is handled by the manager — entity rendering components have no pointer callbacks.
2. **Given** the bin interaction manager, **When** the user clicks, drags, or resizes a bin, **Then** all pointer logic is handled by the manager — bin rendering components have no pointer callbacks.
3. **Given** a new entity type is added, **When** its renderer is created, **Then** it only needs to implement visual rendering — the interaction manager handles all pointer events automatically using shared geometry utilities.
4. **Given** the interaction managers, **When** inspecting the codebase, **Then** there is exactly one location per interaction category (entity, bin) where pointer state (dragging, resizing, hovering) is managed.

---

### Edge Cases

- What happens when a polygon has fewer than 3 vertices? System should treat it as degenerate and skip rendering/interaction.
- What happens when a polygon's computed centroid falls outside its own shape (e.g., concave polygon)? The centroid is still valid for position tracking; bin ownership should use centroid regardless.
- What happens when entities overlap at the same z-level? The entity rendered last (highest array index) receives pointer events first via raycaster distance ordering.
- What happens when a project file contains polygon data in the old world-space format? Migration converts vertices to local-space on load; the original file is not modified until the user saves.
- What happens when the user drags an entity outside all bins? The entity is removed from any bin it was previously assigned to and becomes unassigned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store polygon vertices in local-space (relative to the entity's centroid/transform.position), consistent with how circles and rectangles store their geometry relative to their center.
- **FR-002**: System MUST migrate polygon vertex data from world-space to local-space when loading project files that use the old representation.
- **FR-003**: System MUST provide shared geometry utility functions (entityCenter, entityBounds, entityHalfExtents) that correctly handle all entity types (circle, rectangle, polygon).
- **FR-004**: System MUST use the shared geometry utilities in all locations that compute entity positions or dimensions, eliminating inline geometry calculations.
- **FR-005**: System MUST have exactly one drag interaction system for entities, with no duplicate or competing handlers.
- **FR-006**: System MUST define z-layer positions as named constants in a single module, used by all canvas rendering and interaction components.
- **FR-007**: System MUST correctly include polygons in marquee selection by testing bounding-box overlap (not just transform.position point containment).
- **FR-008**: System MUST correctly compute snap positions for polygons using their actual centroid.
- **FR-009**: System MUST determine bin ownership for polygons using their actual centroid.
- **FR-010**: Entity shapes MUST have filled hit areas so users can click anywhere inside the shape to select it, not just on the outline.
- **FR-011**: Entities MUST display visual feedback (fill opacity and outline color changes) for hover, selected, and colliding states.
- **FR-012**: Resize handles MUST take priority over drag interactions when both are available on a selected entity.
- **FR-013**: *(Blocked by FR-001 through FR-006)* Entity rendering components MUST contain zero pointer event handling logic — all pointer interactions MUST be owned by a dedicated interaction manager.
- **FR-014**: *(Blocked by FR-001 through FR-006)* Bin rendering components MUST contain zero pointer event handling logic — all pointer interactions MUST be owned by a dedicated interaction manager.
- **FR-015**: *(Blocked by FR-001 through FR-006)* Each interaction manager MUST be the single owner of pointer state (dragging, resizing, hovering) for its category, with no state duplication across components.

### Key Entities

- **Entity**: A geometric shape on the canvas (circle, rectangle, polygon). Has a `transform.position` representing its center and type-specific geometry (diameter, width/height, or vertices in local-space).
- **Bin**: A Gridfinity storage bin on the canvas. Entities are assigned to bins based on whether their centroid falls within the bin's footprint.
- **Z-Layer**: A named constant defining the rendering depth of a canvas element category (grid, bin fill, entity fill, entity outline, gizmo, capture plane).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five known polygon bugs (marquee selection, drag double-offset, snap returning (0,0), gizmo at wrong position, bin ownership) are resolved and verified by automated tests.
- **SC-002**: Entity geometry computation exists in exactly one shared module with zero inline duplications across the codebase.
- **SC-003**: Exactly one drag system handles entity movement — no duplicate pointer capture planes or competing event handlers.
- **SC-004**: All z-layer values are defined as named constants — zero magic-number z-positions remain in component files.
- **SC-005**: Existing project files with old-format polygon data load correctly after migration, with no data loss or visual change.
- **SC-006**: Users can click anywhere inside any entity shape (not just its outline) to select it.
- **SC-007**: Adding a new entity type requires geometry logic in exactly one location (the shared utilities module) to work across all canvas interactions.
- **SC-008**: *(Blocked — Story 6)* Entity and bin rendering components contain zero pointer event handlers — all interaction logic is centralized in dedicated managers.
- **SC-009**: *(Blocked — Story 6)* Pointer state (drag, resize, hover) exists in exactly one location per interaction category with no duplication.

## Assumptions

- The polygon normalization (world-space to local-space vertices) is a one-way migration. Once saved with the new format, projects cannot be opened in older versions.
- The project file format version will be incremented to distinguish migrated files.
- Story 6 (interaction manager abstraction) is included in scope but explicitly blocked by Stories 1-5. It cannot be started until the data model, shared utilities, z-layers, and drag consolidation are complete.
- The existing entity type discriminated union (circle, rectangle, polygon) is sufficient. No new entity types are introduced in this feature.

## Scope Boundaries

### In Scope
- Polygon vertex normalization and project file migration
- Shared geometry utility extraction
- Z-layer constants module
- Removing duplicate drag system from EntityRenderer
- Fixing all five polygon bugs
- Entity visual feedback (fills, hover states)
- Interaction manager abstraction (blocked by above items — Story 6)

### Out of Scope
- New entity types (SVG regions, meshes)
- Undo/redo integration
- Performance optimization of raycasting or rendering
