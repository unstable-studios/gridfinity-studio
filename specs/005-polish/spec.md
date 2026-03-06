# Feature Specification: Polish & Cross-Cutting Concerns

**Feature Branch**: `005-polish`
**Created**: 2026-03-06
**Status**: Ready
**Parent**: `001-full-roadmap` (Phase 7)
**Issues**: #116, #117, #118, #120

## Purpose

Analysis, validation, quality-of-life improvements that affect multiple user stories. These tasks require prior user stories to be substantially complete.

## Scope

### Wall/Floor Thickness Analysis (#116)
- Post-bake mesh analysis for thin walls and thin floor regions
- Off-thread analysis via geometry worker
- Visual warnings in review mode (highlight thin regions)

### Deterministic Output Tests (#117)
- Identical project inputs produce identical baked meshes (vertex-level tolerance)
- Identical meshes produce identical STL/3MF output (binary comparison)

### Example Projects (#118)
- Simple socket tray (SVG import + pattern)
- Mixed asset tray (STL + 2D primitives)
- Multi-bin drawer organizer

### Multi-Bin Packing (#120)
- Partition entities into grid-aligned bins with group constraints
- "Auto-pack" action in layout mode

### Contextual Hints System
- Floating hint card at bottom of viewport
- Tool-specific guidance and keyboard shortcuts
- Connected to active tool state

### Deferred Polish
- T176: Unit formatting in sidebar (hardcoded "mm" suffix should read project units)

## Dependencies

- All prior user stories (002, 003, 004) should be substantially complete
- Example projects require SVG/STL import and pattern features from 003
