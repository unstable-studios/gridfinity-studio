# Feature Specification: Full Implementation Roadmap

**Feature Branch**: `001-full-roadmap`
**Created**: 2026-03-04
**Status**: Draft
**Input**: All 36 open GitHub issues (#83–#120) organized into a phased implementation plan

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Design a Custom Gridfinity Bin (Priority: P1)

A maker opens Gridfinity Studio, creates a new project, draws 2D shapes on a layout canvas, extrudes them into 3D solids/cutters, generates a Gridfinity bin around them, and exports an STL for 3D printing.

**Why this priority**: This is the core end-to-end workflow that defines the product's value proposition.

**Independent Test**: Can be tested by completing the full design-to-export pipeline with a simple rectangle cutout in a 1x1 bin.

**Acceptance Scenarios**:

1. **Given** a new project, **When** the user draws a rectangle and extrudes it as a cutter, **Then** a 3D preview shows the bin with the cutout
2. **Given** a completed bin design, **When** the user exports to STL, **Then** a valid mesh file is saved to disk

---

### User Story 2 - Socket Tray with Repeating Pattern (Priority: P2)

A maker imports an SVG outline of a socket, creates a linear pattern with size-aware spacing, places it in a multi-unit bin, and exports for printing.

**Why this priority**: Pattern generation is a key differentiator — manually placing 20+ sockets would be tedious.

**Independent Test**: Import SVG, create pattern with 5 instances, verify spacing respects bounds + gap.

**Acceptance Scenarios**:

1. **Given** an imported SVG shape, **When** the user creates a linear pattern with size-aware pitch, **Then** instances are spaced by bounding box + gap
2. **Given** a pattern in a bin, **When** the user exports, **Then** all instances are included in the mesh

---

### User Story 3 - Iterate on Design with Undo/Redo (Priority: P1)

A user makes changes to entity positions, parameters, and grouping, then uses Cmd+Z / Cmd+Shift+Z to step through history.

**Why this priority**: Non-destructive editing is essential for a design tool — users must be able to experiment freely.

**Independent Test**: Create entity, move it, undo, verify position reverts.

**Acceptance Scenarios**:

1. **Given** a moved entity, **When** the user presses Cmd+Z, **Then** the entity returns to its previous position
2. **Given** multiple undone actions, **When** the user presses Cmd+Shift+Z, **Then** actions are redone in order

---

### User Story 4 - Multi-Bin Layout (Priority: P3)

A maker designs a drawer organizer with multiple bins of different sizes, using the grid overlay and alignment tools to position them precisely.

**Why this priority**: Multi-bin layouts are the end goal but require all foundational systems to be in place first.

**Independent Test**: Create 3 bins of different sizes, align them to grid, export all as batch.

**Acceptance Scenarios**:

1. **Given** multiple bins on the layout, **When** the user selects all and runs batch export, **Then** each bin is exported as a separate STL with sensible filenames

### Edge Cases

- What happens when a cutter extends beyond bin boundaries? (clip to bin volume)
- How does the system handle degenerate SVG paths? (validation + user error message)
- What happens when undo history exceeds memory limits? (cap at N operations)
- How does grid snapping interact with sub-unit placements? (allow with Shift override)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create, open, and save `.gfstudio` project files with full entity state
- **FR-002**: System MUST provide a 2D orthographic layout mode with Gridfinity grid overlay
- **FR-003**: System MUST support circle, rectangle, and polygon 2D primitives
- **FR-004**: System MUST import SVG paths as 2D sketch regions
- **FR-005**: System MUST import STL files as mesh entities
- **FR-006**: System MUST extrude 2D regions into 3D solids and cutters
- **FR-007**: System MUST perform mesh boolean operations (union/subtract/intersect)
- **FR-008**: System MUST generate parametric Gridfinity bin geometry from grid units
- **FR-009**: System MUST support linear pattern generation with multiple spacing modes
- **FR-010**: System MUST export to STL and 3MF formats (single and batch)
- **FR-011**: System MUST provide undo/redo for all project mutations
- **FR-012**: System MUST maintain 60fps during normal viewport interaction
- **FR-013**: System MUST run geometry operations off the UI thread
- **FR-014**: System MUST support select, move, rotate, snap, group, align, and distribute operations

### Key Entities

- **Entity**: Base spatial object (circle, rectangle, polygon, SVG region, STL mesh) with transform
- **Bin**: Gridfinity container defined by grid units with options (lip, magnets, screws)
- **Generator**: Procedural instance creator (linear pattern with spacing modes)
- **Group**: Hierarchical collection of entities with group transform
- **Project**: Root container with global settings, Gridfinity config, entities, bins, generators

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can complete the core workflow (draw shape → extrude → generate bin → export STL) in under 5 minutes
- **SC-002**: Viewport maintains 60fps with 100+ entities on supported hardware
- **SC-003**: All 36 open issues are addressed with acceptance criteria met
- **SC-004**: Test coverage exists for all non-UI logic (validation, geometry, IPC, undo system)
