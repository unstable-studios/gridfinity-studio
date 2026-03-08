# Feature Specification: Layout Engine Abstraction

**Feature Branch**: `009-layout-engine-abstraction`
**Created**: 2026-03-07
**Status**: Draft
**Input**: User description: "Gridfinity Studio Layout Engine Abstraction — Define a library-agnostic LayoutEngine interface that decouples the 2D layout canvas from any specific rendering library."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interact with Layout Shapes via a Unified Interface (Priority: P1)

A designer opens Gridfinity Studio, creates a new project, and begins placing and editing shapes (rectangles, circles, polygons) on the 2D layout canvas. They drag shapes to snap them to the grid, resize shapes using handles, group pockets inside a bin, and see their changes reflected in the sidebar property panel. The designer does not know or care which rendering library powers the canvas — the experience is identical regardless of the underlying engine.

**Why this priority**: This is the core interaction loop. Without a working unified interface that covers shape CRUD, selection, transforms, and event propagation to the host app, nothing else matters.

**Independent Test**: Can be fully tested by creating a project, adding shapes of each supported type (rect, circle, polygon), dragging/resizing/rotating them, grouping shapes into a bin, and verifying that the sidebar reflects selection and property changes in real time.

**Acceptance Scenarios**:

1. **Given** a new project with an empty canvas, **When** the user places a rectangle, **Then** the shape appears on the canvas at the snapped grid position and is immediately selectable.
2. **Given** a canvas with multiple shapes, **When** the user clicks a shape, **Then** that shape is selected, transform handles appear, and the sidebar displays that shape's properties.
3. **Given** a selected shape, **When** the user drags it, **Then** the shape snaps to the grid during movement and the host app receives position-change events.
4. **Given** a selected shape, **When** the user resizes it via handles, **Then** the shape dimensions update, snapping is applied, and the host app receives resize events.
5. **Given** multiple shapes, **When** the user shift-clicks or rubber-band selects them, **Then** all enclosed shapes are selected and a multi-selection transform bounding box appears.
6. **Given** a bin shape and pocket shapes, **When** the user groups them, **Then** the pockets become children of the bin and move/scale together as a unit.
7. **Given** a grouped bin, **When** the user ungroups it, **Then** all child shapes return to independent objects at their correct world positions.

---

### User Story 2 - Switch Rendering Engine at Runtime (Priority: P2)

A developer or power user opens the application preferences and switches the layout engine from one implementation to another (e.g., from Fabric.js to Konva or vice versa). The canvas re-renders with the alternate engine, preserving all existing shapes, groups, selection state, and viewport position. The user continues editing without data loss.

**Why this priority**: Runtime swapping validates that the abstraction truly decouples the engine from the app. It also enables A/B evaluation of engines during development and provides a fallback path if one engine has issues.

**Independent Test**: Can be tested by creating a project with several shapes and groups, switching engines via a toggle, and verifying that all objects, their properties, grouping, and viewport state survive the switch.

**Acceptance Scenarios**:

1. **Given** a project with shapes on the canvas using Engine A, **When** the user switches to Engine B via preferences, **Then** all shapes appear at the same positions with the same dimensions and styling.
2. **Given** a project with grouped objects, **When** the engine is switched, **Then** group hierarchy (parent/child relationships) is preserved.
3. **Given** a zoomed and panned viewport, **When** the engine is switched, **Then** the viewport position and zoom level are restored.
4. **Given** selected objects, **When** the engine is switched, **Then** the selection is restored after the switch completes.

---

### User Story 3 - Save and Load Projects Across Engines (Priority: P3)

A user saves their project, closes the application, reopens it with a different engine configured as default, and loads the saved project. All shapes, groups, and layout data load correctly regardless of which engine was active when the project was saved.

**Why this priority**: Persistence must be engine-agnostic. Project files should never contain engine-specific data that would lock the user into a particular rendering library.

**Independent Test**: Can be tested by saving a project with Engine A, switching the default engine to Engine B, reopening the app, loading the project file, and verifying all data is intact.

**Acceptance Scenarios**:

1. **Given** a project saved with Engine A, **When** the project is loaded with Engine B active, **Then** all shapes, groups, and properties are correctly restored.
2. **Given** a project with all supported shape types (rect, circle, polygon, SVG path), **When** serialized and deserialized, **Then** no data is lost and all shape-specific properties are preserved.
3. **Given** a project file from a previous version of the application, **When** loaded, **Then** the system migrates the data to the current format and renders it correctly.

---

### Edge Cases

- What happens when the user switches engines while a drag operation is in progress? The system cancels the in-progress interaction before switching, rather than corrupting state.
- What happens when one engine supports a shape type that another does not fully support? The system renders a placeholder or simplified representation and displays a non-blocking warning.
- What happens when the canvas container is resized (e.g., sidebar collapse) during an engine switch? The new engine mounts with the correct container dimensions.
- What happens when a project contains shapes positioned outside the visible viewport? The engine preserves off-screen shape positions without clipping or discarding them.
- What happens when an engine adapter fails to initialize (e.g., missing dependency)? The system displays an error message and offers to switch to the other engine.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a unified interface for creating, reading, updating, and deleting shapes on the 2D layout canvas, supporting at minimum: rectangle, circle, polygon, SVG path, and mesh-import placeholder types.
- **FR-002**: The system MUST support grouping shapes into hierarchical containers (bin with child pockets) and ungrouping them back to independent shapes with correct world-space positions.
- **FR-003**: The system MUST support single-click selection, shift-click multi-selection, rubber-band (marquee) selection, and clear-selection operations.
- **FR-004**: The system MUST emit events to the host application when shapes are selected, moved, resized, created, deleted, or when group membership changes.
- **FR-005**: The system MUST support viewport pan (via alt+drag or middle-click), zoom (via scroll wheel toward pointer), and reset-to-origin operations.
- **FR-006**: The system MUST support configurable grid snapping that applies during both drag and resize operations.
- **FR-007**: The system MUST provide serialization (export to engine-agnostic format) and deserialization (import from engine-agnostic format) for all canvas state, independent of the active rendering engine.
- **FR-008**: The system MUST support runtime switching between rendering engines without data loss, preserving all shapes, groups, selection, and viewport state.
- **FR-009**: The system MUST ensure no rendering-library-specific types are exposed beyond the engine adapter boundary — all communication with the host app uses the unified interface types.
- **FR-010**: The system MUST provide two complete adapter implementations satisfying the unified interface.
- **FR-011**: The system MUST expose the active engine instance to UI components (viewport, sidebar, toolbar) through a shared mechanism so that property panels and tools can read and write shape state.
- **FR-012**: The system MUST handle canvas container resize events, updating the engine's internal dimensions to match the new container size.
- **FR-013**: The system MUST support transform handles (resize corners/edges, rotation) on selected shapes with visual feedback during the transform operation.

### Key Entities

- **LayoutShape**: A geometric object on the canvas. Has an ID, type (rect, circle, polygon, SVG path, mesh-import), position, dimensions/radius/points (type-dependent), rotation, fill, stroke, and optional metadata. This is the canonical shape representation shared between engines and the host app.
- **LayoutGroup**: A container that holds child LayoutShapes. Represents a Gridfinity bin with its pockets. Has its own position and transform; children are positioned relative to the group.
- **LayoutSnapshot**: A complete serializable representation of the canvas state — all shapes, groups, viewport position, zoom level, and grid configuration. Used for project persistence and engine switching.
- **LayoutEngine**: The abstract capability contract that any rendering adapter must fulfill. Covers lifecycle, shape CRUD, grouping, selection, viewport, events, and serialization.
- **EngineEvent**: A typed notification from the engine to the host app (selection changed, shape moved, shape resized, shape created, shape deleted, group changed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can place, move, resize, rotate, and delete all supported shape types on the canvas with no perceivable difference in behavior between the two engine implementations.
- **SC-002**: Users can switch between engines and resume editing within 2 seconds, with all shapes, groups, and viewport state preserved.
- **SC-003**: Project files saved with one engine load correctly with the other engine with zero data loss across all supported shape types and group configurations.
- **SC-004**: Sidebar property panels update within 100ms of a shape being selected, moved, or resized, regardless of which engine is active.
- **SC-005**: Grid snapping during drag and resize operates at the same grid pitch and with the same visual precision across both engine implementations.
- **SC-006**: 100% of host-app interactions with the canvas occur through the unified interface — no rendering-library types appear in any component outside the adapter modules.
- **SC-007**: The system supports a minimum of 200 shapes on the canvas without noticeable lag (interaction remains responsive during drag and resize operations).

## Assumptions

- The existing sandbox prototypes (FabricSandbox.tsx and KonvaSandbox.tsx) demonstrate feasibility for both engines and will serve as reference implementations for the adapters.
- SVG path and mesh-import shape types will initially be render-only (display a path/placeholder) with full interactive editing deferred to a later feature.
- The 3D preview (ReviewCanvas) remains unchanged — this feature only affects the 2D layout canvas.
- Runtime engine switching is primarily a developer/evaluation feature. In production, most users will use whichever engine ships as default.
- The existing project file format (.gfstudio JSON) will be extended with engine-agnostic layout data rather than replaced.

## Scope Boundaries

### In Scope

- Unified layout engine interface and types
- Fabric.js v7 adapter implementation
- Konva/react-konva adapter implementation
- Shared mechanism (hook/context) for engine provision to UI components
- Runtime engine switching via preferences
- Engine-agnostic serialization for project persistence
- Integration with existing Viewport, Sidebar, and Navbar components

### Out of Scope

- Changes to the 3D preview (ReviewCanvas)
- STL/3MF mesh import pipeline (reserved fields only)
- Worker-thread geometry processing
- Undo/redo system (will integrate with engine events in a later feature)
- Alignment/snapping guides between objects (beyond grid snap — deferred to later enhancement)

## Dependencies

- Fabric.js v7 and Konva/react-konva (already installed)
- Existing project schema and persistence layer (will be extended)
- Existing Viewport, Sidebar, and Navbar components (will be modified to use the new interface)
