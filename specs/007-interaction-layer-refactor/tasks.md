# Tasks: Canvas Interaction Layer Refactor

**Input**: Design documents from `/specs/007-interaction-layer-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included per constitution Principle III (Test-First Development). Tests written first, verified to fail before implementation.

**Organization**: Tasks grouped by user story. Track A (data model) and Track B (interaction) are interleaved by story priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Create new files and modules that other tasks depend on

- [x] T001 Create shared geometry module `src/shared/geometry/entity-geometry.ts` with exported stubs for `entityCenter()`, `entityBounds()`, `entityHalfExtents()` (return placeholder values, typed correctly against Entity discriminated union)
- [x] T002 [P] Create z-layer constants module `src/renderer/src/lib/z-layers.ts` with all named constants from data-model.md z-layer table

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared geometry utilities that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundation

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] Unit tests for `entityCenter()` in `src/shared/geometry/__tests__/entity-geometry.test.ts` — test circle (returns transform.position), rectangle (returns transform.position), polygon with local-space vertices (returns transform.position), degenerate polygon (<3 vertices)
- [x] T004 [P] Unit tests for `entityBounds()` in `src/shared/geometry/__tests__/entity-geometry.test.ts` — test circle (position ± radius), rectangle (position ± half-extents), polygon (position + vertex min/max), entity at non-origin position
- [x] T005 [P] Unit tests for `entityHalfExtents()` in `src/shared/geometry/__tests__/entity-geometry.test.ts` — test circle (radius, radius), rectangle (width/2, height/2), polygon (vertex bounding box half-extents)

### Implementation for Foundation

- [x] T006 Implement `entityCenter()` in `src/shared/geometry/entity-geometry.ts` — for all entity types, return `transform.position` (after polygon normalization, this is always the center)
- [x] T007 Implement `entityBounds()` in `src/shared/geometry/entity-geometry.ts` — compute AABB from entity center + type-specific extents, handle discriminated union exhaustively
- [x] T008 Implement `entityHalfExtents()` in `src/shared/geometry/entity-geometry.ts` — circle: `{ hw: diameter/2, hh: diameter/2 }`, rectangle: `{ hw: width/2, hh: height/2 }`, polygon: compute from vertex min/max

**Checkpoint**: `pnpm vitest run src/shared/geometry` — all geometry tests pass

---

## Phase 3: User Story 1 — Consistent Polygon Behavior (Priority: P1) MVP

**Goal**: Normalize polygon vertex storage so polygons behave identically to circles/rectangles across all interactions (drag, snap, marquee, bin ownership)

**Independent Test**: Create a polygon, drag it, snap it, marquee-select it, assign to a bin — all work correctly

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] Unit tests for polygon normalization in `src/shared/geometry/__tests__/entity-geometry.test.ts` — test `normalizePolygonVertices()`: given world-space vertices, returns `{ position: centroid, vertices: centroid-relative }`. Test idempotency (already-normalized polygon returns unchanged). Test degenerate cases.
- [x] T010 [P] [US1] Unit tests for project migration in `src/shared/validation/__tests__/migration.test.ts` — test `migrateProject()`: v0.3.0 project with world-space polygon vertices migrates to v0.4.0 with local-space vertices. Test idempotency. Test project with no polygons passes through unchanged. Test schema version is bumped.

### Implementation for User Story 1

- [x] T011 [US1] Add `normalizePolygonVertices()` to `src/shared/geometry/entity-geometry.ts` — computes centroid from vertices, returns new position and offset vertices
- [x] T012 [US1] Bump schema version to `0.4.0` in `src/shared/types/project.ts` — add to `SUPPORTED_VERSIONS` array
- [x] T013 [US1] Add migration function in `src/shared/validation/project-validator.ts` — detect v0.3.0 projects, normalize all polygon entities, bump version
- [x] T014 [US1] Wire migration into project load path in `src/renderer/src/hooks/useProject.ts` — call migration before setting project state
- [x] T015 [US1] Update `PolygonTool.tsx` in `src/renderer/src/components/primitives/PolygonTool.tsx` — normalize vertices on create (compute centroid, set transform.position, offset vertices)
- [x] T016 [US1] Replace inline `entityCenter()` in `src/renderer/src/components/Viewport.tsx` — import from shared geometry, remove local helper function, update `handlePlace()` and `handleMoveEnd()`
- [x] T017 [US1] Replace inline geometry in `src/renderer/src/lib/collision.ts` — replace `getEntityBounds()` body with call to shared `entityBounds()`, keep function signature for backward compatibility
- [x] T018 [P] [US1] Replace inline geometry in `src/renderer/src/lib/snap.ts` — replace `entityCenterTargets()` to use shared `entityCenter()`, fix polygon snap (was returning (0,0))
- [x] T019 [P] [US1] Replace inline geometry in `src/renderer/src/lib/auto-wrap.ts` — remove local `entityHalfExtents()` and `polygonHalfExtents()`, import from shared module
- [x] T020 [P] [US1] Replace inline geometry in `src/renderer/src/lib/entity-shapes.ts` — no changes needed; `entityToVertices()` generates local-space vertex loops, not center/bounds computations. Already correct post-normalization.
- [x] T021 [US1] Fix marquee selection in `src/renderer/src/components/layout/LayoutCanvas.tsx` — replaced center-point containment test with AABB overlap using shared `entityBounds()` + `boundsOverlap()`, so polygons are correctly captured by marquee. Also replaced inline half-extent computations in `MultiSelectionBounds` and `handleZoomToFit` with shared `entityBounds()`.
- [x] T022 [US1] Replace inline centroid/bounds in `src/renderer/src/components/layout/TransformGizmo.tsx` — uses shared `entityCenter()` for centroid computation. No inline bounds computation existed to replace.

**Checkpoint**: Create polygon → drag → snap → marquee-select → bin ownership all work. `pnpm vitest run` — all tests pass. `pnpm typecheck` clean.

---

## Phase 4: User Story 2 — Single, Predictable Drag System (Priority: P1)

**Goal**: Verify exactly one drag system exists for entities (TransformGizmo), no competing handlers

**Independent Test**: Select entity, drag from anywhere on shape, verify smooth movement. Multi-select drag works. Resize handles take priority.

### Implementation for User Story 2

- [x] T023 [US2] Audit `src/renderer/src/components/layout/EntityRenderer.tsx` — verified NO drag logic exists (only click-to-select + hover). No `onDragMove`, `onDragEnd`, or `DragCapturePlane` code.
- [x] T024 [US2] Verify TransformGizmo drag area covers selected entity shapes in `src/renderer/src/components/layout/TransformGizmo.tsx` — confirmed centroid drag handle + full-screen capture plane during drag.
- [x] T025 [US2] Verify resize handle z-ordering takes priority over drag in `src/renderer/src/components/layout/TransformGizmo.tsx` — confirmed resize handles (Z.GIZMO_RESIZE_HANDLE=0.06) > cross (0.05) > drag handle (0.04) > capture plane (0.03).

**Checkpoint**: Entity drag works from anywhere on shape. Resize handles intercept correctly. No pointer event conflicts.

---

## Phase 5: User Story 3 — Shared Geometry Utilities (Priority: P2)

**Goal**: Zero inline geometry duplication remains in the codebase

**Independent Test**: Grep for inline geometry patterns (`entity.diameter / 2`, `entity.width / 2`, manual vertex iteration for bounds) — zero results outside the shared module

### Implementation for User Story 3

- [x] T026 [US3] Verify all inline geometry is replaced — grep confirmed remaining `diameter/2` and `width/2` are in: shared geometry module (correct), entity-shapes.ts (vertex generation, not bounds), snap.ts (edge snap targets). No inline bounds/center/half-extent duplication remains.
- [x] T027 [US3] Update `src/renderer/src/lib/entity-shapes.ts` — no changes needed; `entityToVertices()` generates local-space shape outlines for CSG pockets, not computing bounds. Using raw dimension values directly is correct here.

**Checkpoint**: `grep -rn 'diameter / 2' src/ --include='*.ts' --include='*.tsx'` returns only shared geometry module and its tests.

---

## Phase 6: User Story 4 — Deterministic Z-Layer Ordering (Priority: P2)

**Goal**: All z-position magic numbers replaced with named constants from `z-layers.ts`

**Independent Test**: Grep for numeric z-position literals in component files — zero results

### Implementation for User Story 4

- [x] T028 [P] [US4] Replace z-values in `src/renderer/src/components/layout/LayoutCanvas.tsx` — import Z constants, replace all magic numbers (0.001, 0.002, 0.007, 0.02, -0.01)
- [x] T029 [P] [US4] Replace z-values in `src/renderer/src/components/layout/TransformGizmo.tsx` — import Z constants, replace (0.03, 0.04, 0.05, 0.06)
- [x] T030 [P] [US4] Replace z-values in `src/renderer/src/components/layout/EntityRenderer.tsx` — import Z constants, replace (0.01)
- [x] T031 [P] [US4] Replace z-values in `src/renderer/src/components/layout/SelectionBox.tsx` — import Z constants, replace (0.03)
- [x] T032 [P] [US4] Replace z-values in `src/renderer/src/components/layout/BinFootprint.tsx` — import Z constants, replace (-0.005)
- [x] T033 [P] [US4] Replace z-values in `src/renderer/src/components/layout/KeepOutOverlay.tsx` — import Z constants, replace local Z=0.005 with shared Z.KEEPOUT_OVERLAY
- [x] T034 [P] [US4] Replace z-values in `src/renderer/src/components/primitives/CircleTool.tsx` — import Z constants, replace (0.02, 0.0)
- [x] T035 [P] [US4] Replace z-values in `src/renderer/src/components/primitives/RectangleTool.tsx` — import Z constants, replace (0.02, 0.0)
- [x] T036 [P] [US4] Replace z-values in `src/renderer/src/components/primitives/PolygonTool.tsx` — import Z constants, replace (0.01, 0.02, 0.0)

**Checkpoint**: `grep -rn 'position=\[.*0\.0[0-9]' src/renderer/src/components/ --include='*.tsx'` returns zero results (all replaced by constants).

---

## Phase 7: User Story 5 — Visual Feedback for Entities (Priority: P3)

**Goal**: Entity shapes have fills, hover states, and full-shape clickable areas

**Independent Test**: Hover over entity — fill and outline change. Click inside shape (not on outline) — entity selects. Selected entities show distinct visual state.

### Implementation for User Story 5

- [ ] T037 [US5] Add shape-filling hit areas to `src/renderer/src/components/layout/EntityRenderer.tsx` — for each entity type, render a filled mesh matching the shape (circleGeometry for circles, planeGeometry for rectangles, ShapeGeometry for polygons) with transparent material
- [ ] T038 [US5] Add fill opacity by interaction state in `src/renderer/src/components/layout/EntityRenderer.tsx` — default 2.5% opacity, hovered 5%, selected 8%. Use entity color for fill.
- [ ] T039 [US5] Add hover outline color change in `src/renderer/src/components/layout/EntityRenderer.tsx` — default color (slate), hovered color (blue), selected color (bright blue), colliding color (red). Apply to both outline and fill.

**Checkpoint**: Hover → fill changes. Click inside shape → selects. Selected → distinct visual. All entity types (circle, rectangle, polygon) behave consistently.

---

## Phase 8: User Story 6 — Interaction Manager Abstraction (Priority: P4 — Blocked)

**Goal**: Entity and bin renderers contain zero pointer event logic; all interactions owned by dedicated managers

**Blocked by**: Phases 3-7 (US1-US5 must be complete and verified)

### Implementation for User Story 6

- [ ] T040 [US6] Create `EntityInteractionManager` component in `src/renderer/src/components/layout/EntityInteractionManager.tsx` — extract all pointer event handlers (click, hover) from EntityRenderer into a dedicated manager component that renders invisible hit meshes and delegates to callbacks
- [ ] T041 [US6] Strip pointer handlers from `src/renderer/src/components/layout/EntityRenderer.tsx` — remove onPointerDown, onPointerOver, onPointerOut from shape components. EntityRenderer becomes pure visual renderer receiving only display props (color, fill, position).
- [ ] T042 [US6] Create `BinInteractionManager` component in `src/renderer/src/components/layout/BinInteractionManager.tsx` — extract all bin pointer event handlers (click, drag, resize, hover) from the inline BinDragHandler in LayoutCanvas into a dedicated manager component
- [ ] T043 [US6] Strip pointer handlers from bin rendering in `src/renderer/src/components/layout/LayoutCanvas.tsx` — remove inline BinDragHandler pointer logic, wire BinInteractionManager instead. BinFootprint becomes pure visual renderer.
- [ ] T044 [US6] Verify separation — grep EntityRenderer.tsx and BinFootprint.tsx for `onPointer*` props: zero results. All pointer logic lives in *InteractionManager components.

**Checkpoint**: Entity and bin rendering components have zero pointer callbacks. All interaction logic centralized. Full app interaction still works end-to-end.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [ ] T045 Run full test suite `pnpm vitest run` — all tests pass including new geometry, migration, and selection tests
- [ ] T046 Run `pnpm typecheck` — zero errors across both node and web configs
- [ ] T047 Run `pnpm lint` — zero errors (warnings in threemf-writer.test.ts are pre-existing)
- [ ] T048 Manual smoke test: create project with circle, rectangle, polygon → drag each → snap each → marquee-select all → assign to bins → save → reload → verify all positions preserved
- [ ] T049 Manual smoke test: open a v0.3.0 project file with polygon entities → verify migration runs silently → verify polygons render at correct positions → save → reopen → verify v0.4.0 schema

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 stubs exist)
- **Phase 3 (US1 — Polygon)**: Depends on Phase 2 (shared geometry implemented)
- **Phase 4 (US2 — Drag)**: Depends on Phase 2 (shared geometry for bounds)
- **Phase 5 (US3 — Dedup)**: Depends on Phase 3 (polygon normalization complete, all inline replacements done)
- **Phase 6 (US4 — Z-Layers)**: Depends on Phase 1 (T002 constants exist). Can run in parallel with Phases 3-5.
- **Phase 7 (US5 — Visual)**: Depends on Phase 6 (z-constants applied to EntityRenderer)
- **Phase 8 (US6 — Managers)**: Blocked by Phases 3-7 (all stories complete)
- **Phase 9 (Polish)**: Depends on all desired phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — no other story dependencies
- **US2 (P1)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **US3 (P2)**: Depends on US1 completion (inline geometry replaced during US1)
- **US4 (P2)**: Independent of US1-US3 — can run in parallel after Phase 1
- **US5 (P3)**: Depends on US4 (z-constants in EntityRenderer)
- **US6 (P4)**: Blocked by US1-US5

### Parallel Opportunities

- T001 and T002 (setup) can run in parallel
- T003, T004, T005 (foundation tests) can run in parallel
- T018, T019, T020 (inline replacement in lib files) can run in parallel
- T028-T036 (z-layer replacement across 9 files) can ALL run in parallel
- US4 (z-layers) can run in parallel with US1 (polygon normalization)

---

## Parallel Example: Phase 6 (Z-Layers)

```bash
# All z-layer replacements are independent files — launch all 9 in parallel:
T028: Replace z-values in LayoutCanvas.tsx
T029: Replace z-values in TransformGizmo.tsx
T030: Replace z-values in EntityRenderer.tsx
T031: Replace z-values in SelectionBox.tsx
T032: Replace z-values in BinFootprint.tsx
T033: Replace z-values in KeepOutOverlay.tsx
T034: Replace z-values in CircleTool.tsx
T035: Replace z-values in RectangleTool.tsx
T036: Replace z-values in PolygonTool.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T008)
3. Complete Phase 3: User Story 1 (T009-T022)
4. **STOP and VALIDATE**: All 5 polygon bugs fixed, migration works
5. This alone delivers the highest-value fix

### Incremental Delivery

1. Setup + Foundational → geometry utilities ready
2. US1 (polygon normalization) → 5 bugs fixed (MVP!)
3. US4 (z-layers) → codebase cleanup, can run alongside US1
4. US2 (drag verification) → confirm single drag system
5. US3 (dedup verification) → confirm zero inline geometry
6. US5 (visual feedback) → fills, hovers, hit areas
7. US6 (interaction managers) → architectural end-state

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle III requires TDD — test tasks precede implementation
- Constitution Principle VII (YAGNI) — US6 is deferred until US1-US5 prove the need
- Commit after each phase checkpoint
- The z-layer phase (US4) is highly parallelizable (9 independent file edits)
