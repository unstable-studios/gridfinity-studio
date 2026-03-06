# Feature Specification: Imports, Patterns & Layout Tools (US2)

**Feature Branch**: `003-imports-patterns`
**Created**: 2026-03-06
**Status**: Ready
**Parent**: `001-full-roadmap` (User Story 2)
**Issues**: #91, #94, #95, #96, #97, #98, #99, #100, #101, #104

## User Story

A maker imports an SVG outline of a socket, creates a linear pattern with size-aware spacing, places it in a multi-unit bin, and exports for printing.

**Why this priority**: Pattern generation is a key differentiator — manually placing 20+ sockets would be tedious.

**Independent Test**: Import SVG, create pattern with 5 instances at size-aware pitch, verify spacing matches bounding box + gap.

## Acceptance Scenarios

1. **Given** an imported SVG shape, **When** the user creates a linear pattern with size-aware pitch, **Then** instances are spaced by bounding box + gap
2. **Given** a pattern in a bin, **When** the user exports, **Then** all instances are included in the mesh

## Requirements

- **FR-004**: System MUST import SVG paths as 2D sketch regions
- **FR-005**: System MUST import STL files as mesh entities
- **FR-009**: System MUST support linear pattern generation with multiple spacing modes
- **FR-014**: System MUST support select, move, rotate, snap, group, align, and distribute operations

## Scope

### SVG Import (#91)
- SVG path parser (DOMParser + path segment to polygon)
- IPC handler with native file dialog
- Menu action integration

### STL Import (#104)
- Three.js STLLoader, create MeshEntity
- IPC handler with native file dialog
- Render in layout (2D projection) and review (3D) modes

### Group Entities (#94)
- Group/ungroup with hierarchical transforms
- Undo integration (Group/Ungroup commands)
- Keyboard shortcuts: Cmd+G / Cmd+Shift+G

### Align & Distribute (#95, #96)
- Alignment: left, right, top, bottom, center-h, center-v
- Distribute: equal gaps X/Y, optional grid-unit snap
- Toolbar buttons visible when 2+ entities selected

### Linear Pattern Generator (#97, #98, #99, #100)
- N instances along X or Y axis
- Spacing modes: constant pitch, size-aware, explicit array
- PatternPanel UI
- Undo integration

### Break Pattern Instance (#101)
- Detach one generated instance into a manual entity
- Context menu action

### Snap System Overhaul
- Per-axis resolution with multi-point sources
- Screen-space threshold
- Alignment snap layer with guide lines
- Bin edge snap layer
- Snap point extraction for all entity types
- Configuration UI with toolbar toggles
- See `specs/001-full-roadmap/snap-system-spec.md` for full design

## Dependencies

- Phase 3.5 (UX Foundations) — complete
- 002-undo-redo recommended first (T102 Group/Ungroup undo, T110 pattern undo depend on undo system)
