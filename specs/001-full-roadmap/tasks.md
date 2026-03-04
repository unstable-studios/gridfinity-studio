# Tasks: Full Implementation Roadmap

**Input**: Design documents from `/specs/001-full-roadmap/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ipc-channels.md

**Tests**: Included per Constitution Principle III (Test-First Development, NON-NEGOTIABLE).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Electron desktop app**: `src/main/`, `src/preload/`, `src/renderer/src/`, `src/shared/`
- **Tests**: `src/shared/validation/` (existing pattern), `src/renderer/src/lib/__tests__/` (new)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test runner, new dependencies, and project scaffolding

- [x] T001 Configure Vitest test runner with electron-vite compatible config in `vitest.config.ts`
- [x] T002 [P] Add manifold-3d WASM package to dependencies via `pnpm add manifold-3d`
- [x] T003 [P] Add jszip package for 3MF export via `pnpm add jszip`
- [x] T004 [P] Create test directory structure: `src/renderer/src/lib/__tests__/`, `src/shared/__tests__/`
- [x] T005 [P] Configure Vite worker bundling for `src/renderer/src/workers/geometry.worker.ts` in `electron.vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Schema Extensions

- [x] T006 Extend Entity type with discriminated union variants (CircleEntity, RectangleEntity, PolygonEntity, SvgRegionEntity, MeshEntity) in `src/shared/types/project.ts`
- [x] T007 Add ExtrusionConfig type and optional `extrusion` field to Entity in `src/shared/types/project.ts`
- [x] T008 [P] Add LinearPatternConfig type and concrete Generator config shapes in `src/shared/types/project.ts`
- [x] T009 [P] Add `entityIds` field to Bin type for bin-entity association in `src/shared/types/project.ts`
- [x] T010 Bump schemaVersion to '0.2.0' and add backward-compat handling in `src/shared/types/project.ts`
- [x] T011 Extend project-validator with new entity type validation rules (diameter > 0, vertices >= 3, etc.) in `src/shared/validation/project-validator.ts`
- [x] T012 Write tests for new validation rules (circle, rectangle, polygon, svg-region, mesh, extrusion, pattern) in `src/shared/validation/__tests__/project-validator.test.ts`

### Gridfinity Unit System (#108)

- [x] T013 Write tests for tolerance profiles and unit presets in `src/shared/__tests__/gridfinity-config.test.ts`
- [x] T014 Extract GridfinityConfig defaults into named presets (standard, loose, tight) with tolerance profiles in `src/shared/types/project.ts`
- [x] T015 Create Gridfinity settings panel component in `src/renderer/src/components/settings/GridfinitySettings.tsx`

### Project File Management (#83)

- [ ] T016 Write tests for project:new and project:get-recent IPC handlers in `src/main/__tests__/project-handler.test.ts`
- [x] T017 Implement `project:new` IPC handler returning empty project with defaults in `src/main/project-handler.ts`
- [x] T018 Implement `project:get-recent` IPC handler with recent file path tracking in `src/main/project-handler.ts`
- [x] T019 Register new IPC channels in preload bridge (`project.new`, `project.getRecent`) in `src/preload/index.ts` and `src/preload/index.d.ts`
- [x] T020 Wire File menu actions (New, Open, Save, Save As) to IPC calls in `src/renderer/src/components/Navbar.tsx`
- [x] T021 Extend `useProject` hook with `newProject()` and `recentProjects` in `src/renderer/src/hooks/useProject.tsx`

### Undo/Redo System (#84)

- [x] T022 Write tests for UndoStack command pattern (push, undo, redo, maxDepth, clear) in `src/renderer/src/lib/__tests__/undo.test.ts`
- [x] T023 Implement UndoStack with command pattern (execute/undo, past/future arrays, maxDepth=100) in `src/renderer/src/lib/undo.ts`
- [x] T024 Create `useUndo` hook exposing undo/redo/canUndo/canRedo/pushCommand in `src/renderer/src/hooks/useUndo.ts`
- [x] T025 Add Cmd+Z / Cmd+Shift+Z keyboard shortcuts and undo/redo buttons to Navbar in `src/renderer/src/components/Navbar.tsx`

**Checkpoint**: Foundation ready — schema extended, project files work, undo system operational. User story implementation can now begin.

---

## Phase 3: User Story 1 — Design a Custom Gridfinity Bin (Priority: P1) MVP

**Goal**: A maker creates a new project, draws a 2D rectangle, extrudes it as a cutter, generates a Gridfinity bin around it, previews in 3D, and exports an STL.

**Independent Test**: Complete the full design-to-export pipeline with a simple rectangle cutout in a 1x1 bin.

**Issues**: #86, #87, #88, #89, #90, #92, #93, #102, #103, #105, #106, #107, #109, #111, #112

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US1] Write tests for 2D-to-3D extrusion (polygon → solid, polygon → cutter, depth, direction) in `src/renderer/src/lib/__tests__/extrude.test.ts`
- [ ] T027 [P] [US1] Write tests for parametric Gridfinity bin geometry generator (dimensions, lip, magnets, floor) in `src/renderer/src/lib/__tests__/bin-generator.test.ts`
- [ ] T028 [P] [US1] Write tests for snap target resolution (grid snap, entity anchor snap, modifier key override) in `src/renderer/src/lib/__tests__/snap.test.ts`
- [ ] T029 [P] [US1] Write tests for geometry worker message protocol (extrude request/response, boolean request/response, error handling) in `src/renderer/src/workers/__tests__/geometry.worker.test.ts`

### 2D Layout Mode (#86, #87)

- [ ] T030 [US1] Add layout/review mode state to App with mode toggle in navbar in `src/renderer/src/App.tsx`
- [ ] T031 [US1] Create LayoutCanvas with OrthographicCamera, pan (middle-click), zoom (scroll, cursor-centered) in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [ ] T032 [US1] Create GridOverlay rendering Gridfinity grid lines at baseUnit intervals with toggle in `src/renderer/src/components/layout/GridOverlay.tsx`
- [ ] T033 [US1] Create EntityRenderer for drawing 2D shapes (circle, rectangle, polygon outlines) on the layout canvas in `src/renderer/src/components/layout/EntityRenderer.tsx`

### 2D Primitives (#88, #89, #90)

- [ ] T034 [P] [US1] Create CircleTool for placing circles with diameter editing and anchor points in `src/renderer/src/components/primitives/CircleTool.tsx`
- [ ] T035 [P] [US1] Create RectangleTool for placing rectangles with width/height editing in `src/renderer/src/components/primitives/RectangleTool.tsx`
- [ ] T036 [P] [US1] Create PolygonTool for click-to-place vertex polygon creation in `src/renderer/src/components/primitives/PolygonTool.tsx`
- [ ] T037 [US1] Add primitive tool toolbar to layout mode (circle, rectangle, polygon buttons) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Selection & Transform (#92)

- [ ] T038 [US1] Create `useSelection` hook with click-select, Shift-multiselect, and marquee box select in `src/renderer/src/hooks/useSelection.ts`
- [ ] T039 [US1] Create SelectionBox component for marquee selection rendering in `src/renderer/src/components/layout/SelectionBox.tsx`
- [ ] T040 [US1] Create TransformGizmo with move and rotate handles, Shift-constrain in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [ ] T041 [US1] Integrate selection + transform with undo system (push MoveCommand, RotateCommand) in `src/renderer/src/hooks/useSelection.ts`

### Grid Snapping (#93)

- [ ] T042 [US1] Implement snap target resolution (grid intersections, entity edges/centers) in `src/renderer/src/lib/snap.ts`
- [ ] T043 [US1] Create `useSnapping` hook with global toggle and Shift-to-override in `src/renderer/src/hooks/useSnapping.ts`
- [ ] T044 [US1] Integrate snapping into TransformGizmo drag handlers in `src/renderer/src/components/layout/TransformGizmo.tsx`

### Geometry Worker (#105)

- [ ] T045 [US1] Create geometry Web Worker with manifold WASM initialization and message protocol in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T046 [US1] Define WorkerRequest and WorkerResponse TypeScript types in `src/shared/types/worker.ts`
- [ ] T047 [US1] Create `useGeometryWorker` hook with request/response promise wrapper and progress tracking in `src/renderer/src/hooks/useGeometryWorker.ts`

### Mesh Boolean Engine (#106)

- [ ] T048 [US1] Implement manifold-based union/subtract/intersect operations in the geometry worker in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T049 [US1] Add Three.js BufferGeometry ↔ manifold Mesh conversion utilities in `src/renderer/src/lib/mesh-convert.ts`

### Extrusion (#102, #103)

- [ ] T050 [US1] Implement 2D polygon → 3D solid extrusion (earcut triangulation + Z stitching) in `src/renderer/src/lib/extrude.ts`
- [ ] T051 [US1] Add cutter extrusion mode (role='cutter', direction='down') in `src/renderer/src/lib/extrude.ts`
- [ ] T052 [US1] Wire extrusion through geometry worker (postMessage with polygon + depth, receive mesh) in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T053 [US1] Add extrusion UI controls (depth slider, solid/cutter toggle) to entity properties in `src/renderer/src/components/Sidebar.tsx`

### Bin Generation (#109)

- [ ] T054 [US1] Implement parametric Gridfinity bin mesh generator (walls, floor, lip, magnet/screw recesses) in `src/renderer/src/lib/bin-generator.ts`
- [ ] T055 [US1] Add bin creation UI (width/depth/height in grid units, lip toggle, magnet toggle) to sidebar in `src/renderer/src/components/Sidebar.tsx`
- [ ] T056 [US1] Wire bin generation through geometry worker for large bins in `src/renderer/src/workers/geometry.worker.ts`

### Bake Action (#107)

- [ ] T057 [US1] Implement bake action: combine bin mesh + union solids − subtract cutters via boolean pipeline in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T058 [US1] Add Bake button to toolbar with dirty-state tracking (re-bake needed indicator) in `src/renderer/src/components/Navbar.tsx`
- [ ] T059 [US1] Store BakeResult (mesh, timestamp, dirty flag, warnings) in project runtime state in `src/renderer/src/hooks/useProject.tsx`

### 3D Review Mode (#111)

- [ ] T060 [US1] Create ReviewCanvas with perspective camera, orbit controls, and directional lighting in `src/renderer/src/components/review/ReviewCanvas.tsx`
- [ ] T061 [US1] Create BinPreview rendering baked mesh with material and Z-height slider in `src/renderer/src/components/review/BinPreview.tsx`
- [ ] T062 [US1] Wire mode toggle to switch between LayoutCanvas and ReviewCanvas in `src/renderer/src/components/Viewport.tsx`

### STL Export (#112)

- [ ] T063 [US1] Implement STL export using Three.js STLExporter from baked mesh in `src/renderer/src/lib/stl-io.ts`
- [ ] T064 [US1] Create `export:stl` IPC handler with native save dialog in `src/main/export-handler.ts`
- [ ] T065 [US1] Register export IPC channels in preload bridge in `src/preload/index.ts` and `src/preload/index.d.ts`
- [ ] T066 [US1] Add Export STL button to review mode toolbar in `src/renderer/src/components/Navbar.tsx`

**Checkpoint**: User Story 1 complete — full design-to-export pipeline works. User can draw a rectangle, extrude as cutter, generate bin, preview in 3D, and export STL.

---

## Phase 4: User Story 3 — Iterate on Design with Undo/Redo (Priority: P1)

**Goal**: Undo/redo works for all project mutations — entity CRUD, transforms, parameter changes, grouping.

**Independent Test**: Create entity, move it, change parameters, undo each step, verify state reverts correctly.

**Issues**: #84 (integration across all mutation points from US1)

### Tests for User Story 3

- [ ] T067 [P] [US3] Write integration tests for undo across entity create/delete/move/rotate/parameter-edit in `src/renderer/src/lib/__tests__/undo-integration.test.ts`

### Implementation for User Story 3

- [ ] T068 [US3] Add CreateEntityCommand and DeleteEntityCommand to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T069 [US3] Add UpdateParameterCommand (captures old/new values for any entity field) to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T070 [US3] Integrate undo commands into all primitive creation tools (circle, rectangle, polygon) in `src/renderer/src/components/primitives/CircleTool.tsx`, `RectangleTool.tsx`, `PolygonTool.tsx`
- [ ] T071 [US3] Integrate undo commands into extrusion and bin parameter changes in `src/renderer/src/components/Sidebar.tsx`
- [ ] T072 [US3] Clear undo history on project load/new in `src/renderer/src/hooks/useProject.tsx`
- [ ] T073 [US3] Add undo/redo status to navbar (showing last action label) in `src/renderer/src/components/Navbar.tsx`

**Checkpoint**: User Story 3 complete — all mutations from US1 are undoable/redoable via Cmd+Z / Cmd+Shift+Z.

---

## Phase 5: User Story 2 — Socket Tray with Repeating Pattern (Priority: P2)

**Goal**: Import an SVG socket outline, create a linear pattern with size-aware spacing, place in a multi-unit bin, and export.

**Independent Test**: Import SVG, create pattern with 5 instances at size-aware pitch, verify spacing matches bounding box + gap.

**Issues**: #91, #94, #95, #96, #97, #98, #99, #100, #101, #104

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T074 [P] [US2] Write tests for SVG path parsing (simple paths, compound paths, transforms, degenerate cases) in `src/renderer/src/lib/__tests__/svg-import.test.ts`
- [ ] T075 [P] [US2] Write tests for linear pattern spacing (constant pitch, size-aware, explicit array) in `src/renderer/src/lib/__tests__/pattern.test.ts`
- [ ] T076 [P] [US2] Write tests for STL import (binary, ASCII, mesh entity creation) in `src/renderer/src/lib/__tests__/stl-io.test.ts`

### SVG Import (#91)

- [ ] T077 [US2] Implement SVG path parser using DOMParser + path segment → polygon conversion in `src/renderer/src/lib/svg-import.ts`
- [ ] T078 [US2] Create `import:svg` IPC handler with native file dialog (filter: .svg) in `src/main/import-handler.ts`
- [ ] T079 [US2] Register import IPC channels in preload bridge in `src/preload/index.ts` and `src/preload/index.d.ts`
- [ ] T080 [US2] Add Import SVG menu action and integrate with entity creation in `src/renderer/src/components/Navbar.tsx`

### STL Import (#104)

- [ ] T081 [US2] Implement STL import using Three.js STLLoader, create MeshEntity in `src/renderer/src/lib/stl-io.ts`
- [ ] T082 [US2] Create `import:stl` IPC handler with native file dialog (filter: .stl) in `src/main/import-handler.ts`
- [ ] T083 [US2] Add Import STL menu action in `src/renderer/src/components/Navbar.tsx`
- [ ] T084 [US2] Render imported STL meshes in layout mode (2D footprint projection) and review mode (full 3D) in `src/renderer/src/components/layout/EntityRenderer.tsx`

### Group Entities (#94)

- [ ] T085 [US2] Implement group/ungroup logic with hierarchical transforms in project state in `src/renderer/src/hooks/useProject.tsx`
- [ ] T086 [US2] Add Group/Ungroup commands to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T087 [US2] Add Group/Ungroup keyboard shortcuts (Cmd+G / Cmd+Shift+G) and menu items in `src/renderer/src/components/Navbar.tsx`

### Align & Distribute Tools (#95, #96)

- [ ] T088 [P] [US2] Implement alignment actions (left, right, top, bottom, center-h, center-v) for selected entities in `src/renderer/src/lib/align.ts`
- [ ] T089 [P] [US2] Implement distribute actions (equal gaps X, equal gaps Y, optional grid-unit snap) for selected entities in `src/renderer/src/lib/distribute.ts`
- [ ] T090 [US2] Add align/distribute toolbar buttons (visible when 2+ entities selected) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Linear Pattern Generator (#97)

- [ ] T091 [US2] Implement linear pattern generator creating N instances along X or Y axis in `src/renderer/src/lib/pattern.ts`
- [ ] T092 [US2] Create PatternPanel UI (axis, count, spacing mode selector) in `src/renderer/src/components/patterns/PatternPanel.tsx`
- [ ] T093 [US2] Render pattern instances as instanced entities in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`
- [ ] T094 [US2] Integrate pattern generator with undo system (CreatePatternCommand) in `src/renderer/src/lib/undo.ts`

### Pattern Spacing Modes (#98, #99, #100)

- [ ] T095 [US2] Implement constant-pitch spacing mode (fixed distance between instances) in `src/renderer/src/lib/pattern.ts`
- [ ] T096 [US2] Implement size-aware spacing mode (bounding box + configurable gap) in `src/renderer/src/lib/pattern.ts`
- [ ] T097 [US2] Implement explicit-array spacing mode (per-instance position list) in `src/renderer/src/lib/pattern.ts`
- [ ] T098 [US2] Add spacing mode UI controls to PatternPanel (pitch input, gap input, position list editor) in `src/renderer/src/components/patterns/PatternPanel.tsx`

### Break Pattern Instance (#101)

- [ ] T099 [US2] Implement break-instance action: detach one generated instance into a manual entity in `src/renderer/src/lib/pattern.ts`
- [ ] T100 [US2] Add Break Instance context menu action for pattern instances in `src/renderer/src/components/layout/EntityRenderer.tsx`

**Checkpoint**: User Story 2 complete — SVG import, patterns with all spacing modes, groups, align/distribute all working. Socket tray workflow functional.

---

## Phase 6: User Story 4 — Multi-Bin Layout (Priority: P3)

**Goal**: Design a drawer organizer with multiple bins, use grid overlay and alignment to position precisely, batch export all bins.

**Independent Test**: Create 3 bins of different sizes, align to grid, export all as batch STL with sensible filenames.

**Issues**: #113, #114, #115, #119, #110

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T101 [P] [US4] Write tests for 3MF writer (valid ZIP structure, XML schema, mesh data) in `src/renderer/src/lib/__tests__/threemf-writer.test.ts`
- [ ] T102 [P] [US4] Write tests for collision detection (overlapping footprints, non-overlapping, edge-touching) in `src/renderer/src/lib/__tests__/collision.test.ts`
- [ ] T103 [P] [US4] Write tests for auto-wrap (minimal grid-aligned bin size for selection) in `src/renderer/src/lib/__tests__/auto-wrap.test.ts`

### Batch Export (#113)

- [ ] T104 [US4] Create `export:batch` IPC handler with directory dialog and filename pattern in `src/main/export-handler.ts`
- [ ] T105 [US4] Add batch export UI (all bins / selected bins, filename pattern, format selector) in `src/renderer/src/components/export/ExportPanel.tsx`
- [ ] T106 [US4] Wire ExportPanel into sidebar Export tab in `src/renderer/src/components/Sidebar.tsx`

### 3MF Export (#119)

- [ ] T107 [US4] Implement minimal 3MF writer (ZIP via jszip, XML model file, mesh data) in `src/renderer/src/lib/threemf-writer.ts`
- [ ] T108 [US4] Create `export:3mf` IPC handler with native save dialog in `src/main/export-handler.ts`
- [ ] T109 [US4] Add 3MF format option to export panel and single-export toolbar in `src/renderer/src/components/export/ExportPanel.tsx`

### Collision Detection (#115)

- [ ] T110 [US4] Implement 2D footprint overlap detection for entities within a bin in `src/renderer/src/lib/collision.ts`
- [ ] T111 [US4] Render collision warnings as visual indicators (red outlines) in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`

### Gridfinity Keep-Out Visualization (#114)

- [ ] T112 [US4] Calculate keep-out regions from GridfinityConfig (magnet circles, screw holes, lip inset) in `src/renderer/src/lib/keep-out.ts`
- [ ] T113 [US4] Render keep-out zones as semi-transparent overlays in layout and review modes in `src/renderer/src/components/layout/GridOverlay.tsx`

### Auto-Wrap Selection into Bin (#110)

- [ ] T114 [US4] Implement auto-wrap: compute minimal grid-aligned bin dimensions for selected entities with margins in `src/renderer/src/lib/auto-wrap.ts`
- [ ] T115 [US4] Add "Auto-wrap" action button (visible when entities selected without a bin) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

**Checkpoint**: User Story 4 complete — multiple bins, batch export (STL + 3MF), collision warnings, keep-out visualization, auto-wrap all working.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Analysis, validation, quality-of-life improvements that affect multiple user stories

### Wall/Floor Thickness Analysis (#116)

- [ ] T116 [P] Write tests for thickness analysis (thin wall detection, thin floor detection, within-tolerance passes) in `src/renderer/src/lib/__tests__/analysis.test.ts`
- [ ] T117 Implement post-bake mesh analysis for thin walls and thin floor regions in `src/renderer/src/lib/analysis.ts`
- [ ] T118 Add 'analyze' message type to geometry worker for off-thread analysis in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T119 Display analysis warnings in review mode (highlight thin regions, warning panel) in `src/renderer/src/components/review/BinPreview.tsx`

### Deterministic Output Tests (#117)

- [ ] T120 Write deterministic output tests: identical project inputs → identical baked meshes (vertex-level tolerance comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`
- [ ] T121 Write deterministic export tests: identical baked meshes → identical STL/3MF output (binary comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`

### Example Projects (#118)

- [ ] T122 [P] Create example project: simple socket tray (SVG import + pattern) in `examples/socket-tray.gfstudio`
- [ ] T123 [P] Create example project: mixed asset tray (STL + 2D primitives) in `examples/mixed-assets.gfstudio`
- [ ] T124 [P] Create example project: multi-bin drawer organizer in `examples/drawer-organizer.gfstudio`

### Multi-Bin Packing (#120)

- [ ] T125 Write tests for multi-bin packing (partition by area, keep groups together, grid alignment) in `src/renderer/src/lib/__tests__/packing.test.ts`
- [ ] T126 Implement multi-bin packing algorithm: partition entities into grid-aligned bins with group constraints in `src/renderer/src/lib/packing.ts`
- [ ] T127 Add "Auto-pack" action in layout mode that creates bins from packing result in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Final Validation

- [ ] T128 Run `pnpm typecheck` and fix any type errors across all new files
- [ ] T129 Run `pnpm lint` and fix any linting issues across all new files
- [ ] T130 Run `pnpm format` and fix any formatting issues across all new files
- [ ] T131 Run full test suite and verify all tests pass
- [ ] T132 Run quickstart.md validation: verify end-to-end workflow (draw → extrude → bake → export) works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Vitest, deps) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — delivers the core pipeline (MVP)
- **US3 (Phase 4)**: Depends on US1 — integrates undo across all US1 mutation points
- **US2 (Phase 5)**: Depends on Foundational — can start in parallel with US1 after Phase 2, but full testing requires US1's extrusion + bake pipeline
- **US4 (Phase 6)**: Depends on US1 (needs export, review mode) — adds batch export, analysis, keep-outs
- **Polish (Phase 7)**: Depends on US1 + US4 — cross-cutting analysis and examples

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 3 (P1)**: Depends on US1 — undo commands wrap US1's mutation points
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — pattern/SVG work is independent, but bake integration needs US1's geometry worker
- **User Story 4 (P3)**: Depends on US1 — needs export infrastructure, review mode, bin generation

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle III)
- Types/schemas before implementation logic
- Core lib functions before UI components
- Worker integration before UI controls
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1** (all [P] tasks):
- T002, T003, T004, T005 can all run in parallel

**Phase 2**:
- T008, T009 can run in parallel (independent type additions)
- T013, T016, T022 can run in parallel (independent test files)

**Phase 3** (within US1):
- T026, T027, T028, T029 — all test files in parallel
- T034, T035, T036 — primitive tools in parallel (different files)

**Phase 5** (within US2):
- T074, T075, T076 — all test files in parallel
- T088, T089 — align and distribute in parallel (different files)

**Phase 6** (within US4):
- T101, T102, T103 — all test files in parallel
- T122, T123, T124 — example projects in parallel

**Cross-story parallelism**:
- After Phase 2, US1 and the test-writing portion of US2 (T074–T076) can start in parallel
- After US1, US3 and US4 can proceed in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: T026 "Write extrusion tests in src/renderer/src/lib/__tests__/extrude.test.ts"
Task: T027 "Write bin-generator tests in src/renderer/src/lib/__tests__/bin-generator.test.ts"
Task: T028 "Write snap tests in src/renderer/src/lib/__tests__/snap.test.ts"
Task: T029 "Write worker protocol tests in src/renderer/src/workers/__tests__/geometry.worker.test.ts"

# Launch all primitive tools in parallel:
Task: T034 "Create CircleTool in src/renderer/src/components/primitives/CircleTool.tsx"
Task: T035 "Create RectangleTool in src/renderer/src/components/primitives/RectangleTool.tsx"
Task: T036 "Create PolygonTool in src/renderer/src/components/primitives/PolygonTool.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch all tests for US2 together:
Task: T074 "Write SVG import tests in src/renderer/src/lib/__tests__/svg-import.test.ts"
Task: T075 "Write pattern spacing tests in src/renderer/src/lib/__tests__/pattern.test.ts"
Task: T076 "Write STL import tests in src/renderer/src/lib/__tests__/stl-io.test.ts"

# Launch align and distribute in parallel:
Task: T088 "Implement alignment actions in src/renderer/src/lib/align.ts"
Task: T089 "Implement distribute actions in src/renderer/src/lib/distribute.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T025) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T026–T066)
4. **STOP and VALIDATE**: Test full pipeline: draw rectangle → extrude → bake → review → export STL
5. Demo if ready — this is a working product

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Demo (MVP! Core bin design works)
3. Add US3 → Test independently → Demo (Undo/redo for all mutations)
4. Add US2 → Test independently → Demo (SVG import + patterns for socket trays)
5. Add US4 → Test independently → Demo (Multi-bin layouts with batch export)
6. Add Polish → Full product with analysis, examples, packing

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (core pipeline)
   - Developer B: User Story 2 tests + SVG/pattern lib code (T074–T076, T077, T091–T097)
3. After US1 completes:
   - Developer A: User Story 3 (undo integration)
   - Developer B: User Story 2 (remaining UI + worker integration)
   - Developer C: User Story 4 (batch export, analysis, keep-outs)
4. Polish phase: all developers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Constitution Principle III)
- Commit after each task or logical group using conventional commits
- Stop at any checkpoint to validate story independently
- Constitution gates: `pnpm typecheck && pnpm lint && pnpm format` must pass at each checkpoint
