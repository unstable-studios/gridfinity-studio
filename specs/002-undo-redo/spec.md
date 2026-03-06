# Feature Specification: Undo/Redo System (US3)

**Feature Branch**: `002-undo-redo`
**Created**: 2026-03-06
**Status**: Ready
**Parent**: `001-full-roadmap` (User Story 3)
**Issues**: #84

## User Story

A user makes changes to entity positions, parameters, and grouping, then uses Cmd+Z / Cmd+Shift+Z to step through history.

**Why this priority**: Non-destructive editing is essential for a design tool — users must be able to experiment freely.

**Independent Test**: Create entity, move it, undo, verify position reverts.

## Acceptance Scenarios

1. **Given** a moved entity, **When** the user presses Cmd+Z, **Then** the entity returns to its previous position
2. **Given** multiple undone actions, **When** the user presses Cmd+Shift+Z, **Then** actions are redone in order

## Requirements

- **FR-011**: System MUST provide undo/redo for all project mutations
- Undo/redo covers: entity create, delete, move, rotate, parameter edit, extrusion changes, bin parameter changes
- Undo history clears on project load/new
- Navbar shows last action label and disabled state for undo/redo buttons

## Scope

### In Scope
- Command pattern for all entity mutations (CRUD, transforms, parameters)
- Cmd+Z / Cmd+Shift+Z keyboard shortcuts
- Integration with primitive tools, TransformGizmo, sidebar property editing
- Undo/redo status in navbar
- Clear history on project load/new

### Out of Scope
- Group/Ungroup undo (covered in 003-imports-patterns as part of US2 grouping)
- Persistent undo history across sessions

## Dependencies

- Phase 3.5 (UX Foundations) — complete
- Controlled sidebar inputs (T168-T170) — complete
- TransformGizmo resize handles (T167) — complete
