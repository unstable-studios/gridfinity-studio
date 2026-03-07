# Implementation Plan: Canvas Interaction Layer Refactor

**Branch**: `007-interaction-layer-refactor` | **Date**: 2026-03-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-interaction-layer-refactor/spec.md`

## Summary

Normalize polygon entity geometry so all entity types use `transform.position` as their center, extract shared geometry utilities to eliminate 6+ file duplication, define z-layer constants to replace 15+ magic numbers, fix 5 polygon interaction bugs, add entity visual feedback (fills, hover), and consolidate pointer event handling. Two implementation tracks: Track A (data model normalization) and Track B (interaction consolidation), with a blocked Story 6 (interaction manager abstraction) deferred until both tracks complete.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, no `any`)
**Primary Dependencies**: React 19, Three.js via @react-three/fiber, @react-three/drei, Electron 39
**Storage**: `.gfstudio` JSON files, schema version 0.3.0 → 0.4.0
**Testing**: Vitest (unit tests, 21 existing selection tests)
**Target Platform**: macOS, Windows, Linux (Electron desktop)
**Project Type**: Desktop app (Electron)
**Performance Goals**: 60 fps during pan/zoom/select/drag interactions
**Constraints**: No `any` types, conventional commits, TDD per constitution
**Scale/Scope**: ~15 files modified, 2 new files created, 1 schema migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety & Schema Correctness | PASS | Schema migration from 0.3.0→0.4.0 with backward compatibility. Shared geometry functions are fully typed with discriminated union exhaustiveness. |
| II. Electron Process Isolation | PASS | Shared geometry utilities placed in `src/shared/` (process-agnostic). Z-layer constants in renderer only (appropriate). |
| III. Test-First Development | PASS | Unit tests for geometry utilities, migration logic, marquee overlap. TDD flow: write failing tests first. |
| IV. 3D Performance | PASS | No new Three.js objects created. Shape fills use existing mesh patterns. Z-layer changes are cosmetic (same draw calls). |
| V. User Experience & Accessibility | PASS | Fixes 5 interaction bugs. Adds hover states and filled hit areas for better affordances. |
| VI. Conventional Commits | PASS | Standard workflow applies. |
| VII. Simplicity & YAGNI | PASS | Shared geometry is 3 functions replacing 6+ inline implementations — net reduction in code. Z-constants is a flat object, not an abstraction layer. Story 6 deferred to avoid premature abstraction. |

**Post-Phase 1 re-check**: All gates still pass. The shared geometry module is minimal (3 exported functions). Migration logic is a single function. No unnecessary abstractions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/007-interaction-layer-refactor/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── types/
│   │   └── project.ts              # Schema version bump 0.3.0 → 0.4.0
│   ├── geometry/
│   │   └── entity-geometry.ts      # NEW: entityCenter, entityBounds, entityHalfExtents
│   └── validation/
│       └── project-validator.ts    # Migration logic for polygon normalization
│
├── renderer/src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── EntityRenderer.tsx  # Shape fills, hover states, full-shape hit areas
│   │   │   ├── TransformGizmo.tsx  # Use shared geometry, z-constants
│   │   │   ├── LayoutCanvas.tsx    # Marquee AABB overlap, z-constants
│   │   │   ├── BinFootprint.tsx    # z-constants
│   │   │   ├── SelectionBox.tsx    # z-constants
│   │   │   └── KeepOutOverlay.tsx  # z-constants
│   │   ├── primitives/
│   │   │   ├── PolygonTool.tsx     # Normalize vertices on create, z-constants
│   │   │   ├── CircleTool.tsx      # z-constants
│   │   │   └── RectangleTool.tsx   # z-constants
│   │   └── Viewport.tsx            # Use shared entityCenter, remove inline helper
│   ├── hooks/
│   │   └── useProject.ts           # Call migration on load
│   └── lib/
│       ├── z-layers.ts             # NEW: z-layer constants
│       ├── collision.ts            # Use shared geometry
│       ├── snap.ts                 # Use shared geometry
│       ├── entity-shapes.ts        # Use shared geometry
│       └── auto-wrap.ts            # Use shared geometry, remove local entityHalfExtents
│
└── shared/geometry/
    └── __tests__/
        └── entity-geometry.test.ts # NEW: geometry utility tests
```

**Structure Decision**: Follows existing Electron multi-process layout. New shared geometry module in `src/shared/geometry/` for cross-process availability. Z-layer constants in `src/renderer/src/lib/` since they're renderer-only concerns.

## Implementation Tracks

### Track A: Data Model Normalization (Stories 1, 3)

**Step A1**: Shared geometry utilities
- Create `src/shared/geometry/entity-geometry.ts` with `entityCenter()`, `entityBounds()`, `entityHalfExtents()`
- Write tests first (TDD): all entity types, edge cases (degenerate polygon, zero-size)
- Functions handle the discriminated union with exhaustive switch

**Step A2**: Polygon normalization on creation
- Update `PolygonTool.tsx` to compute centroid and normalize vertices before calling `onPlace()`
- Update `Viewport.tsx` `handlePlace()` to use `entityCenter()` instead of inline computation

**Step A3**: Project file migration
- Bump schema version to `0.4.0` in `project.ts`
- Add migration function in validator/loader
- Write tests: migration correctness, idempotency, round-trip

**Step A4**: Replace inline geometry with shared utilities
- `collision.ts`: replace `getEntityBounds()` body with `entityBounds()`
- `snap.ts`: replace `entityCenterTargets()` with `entityCenter()`
- `auto-wrap.ts`: replace local `entityHalfExtents()` + `polygonHalfExtents()` with shared
- `entity-shapes.ts`: use `entityHalfExtents()` where applicable
- `TransformGizmo.tsx`: replace centroid + bounds computation with shared functions
- `Viewport.tsx`: replace `entityCenter()` inline helper with shared import
- `LayoutCanvas.tsx`: replace marquee center-point test with `entityBounds()` AABB overlap

### Track B: Interaction Consolidation (Stories 2, 4, 5)

**Step B1**: Z-layer constants
- Create `src/renderer/src/lib/z-layers.ts` with named constants
- Replace all magic z-values across ~10 component files
- Verify no visual or interaction changes (pure refactor)

**Step B2**: Entity visual feedback
- EntityRenderer: add shape-filling meshes with opacity by state (default 2.5%, hover 5%, selected 8%)
- EntityRenderer: add full-shape hit areas per entity type (circle, rectangle, polygon ShapeGeometry)
- EntityRenderer: add hover state visual feedback (outline color change)

**Step B3**: Drag system verification
- Confirm EntityRenderer has NO drag logic (click-to-select + hover only)
- Confirm TransformGizmo is the sole drag handler
- Verify resize handles take priority over drag (z-ordering via constants)

### Track C: Interaction Manager (Story 6 — Blocked)

**Blocked by**: Steps A1-A4, B1-B3
- Extract all pointer event logic from EntityRenderer into EntityInteractionManager
- Extract all pointer event logic from BinDragHandler into BinInteractionManager
- EntityRenderer and BinFootprint become pure visual renderers (zero pointer callbacks)
- Not started until Tracks A and B are complete and verified

## Complexity Tracking

> No constitution violations. All changes reduce complexity (shared utilities replace duplication, constants replace magic numbers).
