# Feature Specification: Multi-Bin Layout & Export (US4)

**Feature Branch**: `004-multi-bin-export`
**Created**: 2026-03-06
**Status**: Ready
**Parent**: `001-full-roadmap` (User Story 4)
**Issues**: #110, #113, #114, #115, #119

## User Story

A maker designs a drawer organizer with multiple bins of different sizes, using the grid overlay and alignment tools to position them precisely, then batch exports all bins.

**Why this priority**: Multi-bin layouts are the end goal but require all foundational systems to be in place first.

**Independent Test**: Create 3 bins of different sizes, align to grid, export all as batch STL with sensible filenames.

## Acceptance Scenarios

1. **Given** multiple bins on the layout, **When** the user selects all and runs batch export, **Then** each bin is exported as a separate STL with sensible filenames

## Requirements

- **FR-010**: System MUST export to STL and 3MF formats (single and batch)
- Batch export with directory dialog and filename pattern
- 3MF export (ZIP via jszip, XML model, mesh data)
- 2D collision detection with visual warnings
- Gridfinity keep-out zone visualization
- Auto-wrap: compute minimal grid-aligned bin for selected entities

## Scope

### Batch Export (#113)
- IPC handler with directory dialog and filename pattern
- UI: all bins / selected bins, filename pattern, format selector
- Wire into sidebar Export tab

### 3MF Export (#119)
- Minimal 3MF writer (jszip + XML model)
- IPC handler with native save dialog
- Format option in export panel

### Collision Detection (#115)
- 2D footprint overlap detection
- Visual warnings (red outlines) in layout mode

### Keep-Out Visualization (#114)
- Calculate keep-out from GridfinityConfig (magnets, screws, lip inset)
- Render as semi-transparent overlays in layout and review modes

### Auto-Wrap (#110)
- Compute minimal grid-aligned bin dimensions for selected entities
- Action button visible when entities selected without a bin

## Dependencies

- Phase 3.5 (UX Foundations) — complete
- CSG bin generator — complete
- STL export — complete (basic single-file)
- 002-undo-redo and 003-imports-patterns can proceed in parallel
