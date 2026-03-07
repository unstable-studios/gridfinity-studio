# Quickstart: Canvas Interaction Layer Refactor

**Feature Branch**: `007-interaction-layer-refactor`
**Date**: 2026-03-06

## Overview

This feature normalizes polygon entity geometry, extracts shared geometry utilities, consolidates pointer event handling, and defines z-layer constants. It fixes 5 polygon bugs and eliminates geometry computation duplication across the codebase.

## Two Tracks

### Track A: Data Model Normalization
1. Create shared geometry utilities (`entityCenter`, `entityBounds`, `entityHalfExtents`)
2. Normalize polygon vertices to local-space (centroid-relative)
3. Add project file migration (v0.3.0 → v0.4.0)
4. Replace all inline geometry computation with shared utility calls
5. Fix polygon bugs: marquee selection, snap, bin ownership

### Track B: Interaction Consolidation
1. Create z-layer constants module
2. Replace all magic z-values with named constants
3. Add entity shape fills and hover states
4. Ensure TransformGizmo is the sole drag system (remove any duplicate drag code)
5. (Blocked) Interaction manager abstraction

## Key Files

### New Files
- `src/shared/geometry/entity-geometry.ts` — shared geometry utilities
- `src/renderer/src/lib/z-layers.ts` — z-layer constants

### Modified Files (high impact)
- `src/shared/types/project.ts` — schema version bump
- `src/shared/validation/project-validator.ts` — migration logic
- `src/renderer/src/components/layout/EntityRenderer.tsx` — shape fills, hover states
- `src/renderer/src/components/layout/TransformGizmo.tsx` — use shared geometry
- `src/renderer/src/components/layout/LayoutCanvas.tsx` — marquee fix, z-constants
- `src/renderer/src/components/primitives/PolygonTool.tsx` — normalize on create
- `src/renderer/src/hooks/useProject.ts` — migration on load
- `src/renderer/src/lib/collision.ts` — use shared geometry
- `src/renderer/src/lib/snap.ts` — use shared geometry
- `src/renderer/src/lib/auto-wrap.ts` — use shared geometry

## Dev Workflow

```bash
git checkout 007-interaction-layer-refactor
pnpm install
pnpm dev                    # Start dev server
pnpm vitest run             # Run all tests
pnpm typecheck              # Type check
```

## Testing Strategy

- Unit tests for shared geometry utilities (all entity types)
- Unit tests for migration logic (round-trip, idempotency)
- Unit tests for marquee bounding-box overlap
- Existing selection tests (21 tests) verify selection logic
- Manual verification: create polygon, drag, snap, marquee-select, assign to bin
