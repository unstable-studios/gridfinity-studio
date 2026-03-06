# Tasks: Full Implementation Roadmap

**Input**: Design documents from `/specs/001-full-roadmap/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ipc-channels.md

**Tests**: Included per Constitution Principle III (Test-First Development, NON-NEGOTIABLE).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Current State**: Phases 1–3 complete. Phase 3.5 partially complete — CSG-first bin generator (T171/T210–T217) done, pocket system working, review canvas with proper normals. Remaining Phase 3.5 work: echo-libs integration, canvas interaction fixes, real-time property editing, unit system, preferences modal, window management.

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

- [x] T016 Write tests for project:new and project:get-recent IPC handlers in `src/main/__tests__/project-handler.test.ts`
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

**IMPORTANT — Integration Gap**: Components below marked [x] exist as isolated implementations. The integration layer (see plan.md "Integration Architecture") was never built. Tasks marked [ ] represent the missing wiring that connects these components into a working pipeline.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T026 [P] [US1] Write tests for 2D-to-3D extrusion (polygon → solid, polygon → cutter, depth, direction) in `src/renderer/src/lib/__tests__/extrude.test.ts`
- [x] T027 [P] [US1] Write tests for parametric Gridfinity bin geometry generator (dimensions, lip, magnets, floor) in `src/renderer/src/lib/__tests__/bin-generator.test.ts`
- [x] T028 [P] [US1] Write tests for snap target resolution (grid snap, entity anchor snap, modifier key override) in `src/renderer/src/lib/__tests__/snap.test.ts`
- [x] T029 [P] [US1] Write tests for geometry worker message protocol (extrude request/response, boolean request/response, error handling) in `src/renderer/src/workers/__tests__/geometry.worker.test.ts`
- [x] T030 [P] [US1] Write integration tests for entity creation round-trip (tool click → addEntity → EntityRenderer re-render) in `src/renderer/src/lib/__tests__/entity-integration.test.ts`

### Entity Mutation API (PREREQUISITE — blocks all tools)

- [x] T031 [US1] Add `addEntity(entity)`, `updateEntity(id, patch)`, `removeEntity(id)` methods to `useProject` hook in `src/renderer/src/hooks/useProject.tsx`
- [x] T032 [US1] Write tests for entity mutation API (add, update, remove, ID generation, default population) in `src/renderer/src/hooks/__tests__/entity-mutations.test.ts`

### 2D Layout Mode (#86, #87)

- [x] T033 [US1] Add layout/review mode state to App with mode toggle in navbar in `src/renderer/src/App.tsx`
- [x] T034 [US1] Create LayoutCanvas with OrthographicCamera, pan (middle-click), zoom (scroll, cursor-centered) in `src/renderer/src/components/layout/LayoutCanvas.tsx` — **BUG: camera never updates reactively, see T150**
- [x] T035 [US1] Create GridOverlay rendering Gridfinity grid lines at baseUnit intervals with toggle in `src/renderer/src/components/layout/GridOverlay.tsx`
- [x] T036 [US1] Create EntityRenderer for drawing 2D shapes (circle, rectangle, polygon outlines) on the layout canvas in `src/renderer/src/components/layout/EntityRenderer.tsx`

### 2D Primitives (#88, #89, #90) — Components exist, wiring missing

- [x] T037 [P] [US1] Create CircleTool for placing circles with click-drag on Three.js hit plane in `src/renderer/src/components/primitives/CircleTool.tsx`
- [x] T038 [P] [US1] Create RectangleTool for placing rectangles with click-drag on Three.js hit plane in `src/renderer/src/components/primitives/RectangleTool.tsx`
- [x] T039 [P] [US1] Create PolygonTool for click-to-place vertex polygon creation on Three.js hit plane in `src/renderer/src/components/primitives/PolygonTool.tsx`
- [x] T040 [US1] Add primitive tool toolbar to layout mode (circle, rectangle, polygon buttons) in `src/renderer/src/components/Navbar.tsx`
- [x] T041 [US1] Mount active tool component (CircleTool/RectangleTool/PolygonTool) in LayoutScene based on `useAppMode().activeTool` in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [x] T042 [US1] Wire tool `onPlace(partialEntity)` callbacks to generate ID + defaults and call `useProject().addEntity(entity)` in `src/renderer/src/components/Viewport.tsx`

### Selection & Transform (#92) — Components exist, wiring missing

- [x] T043 [US1] Create `useSelection` hook with click-select, Shift-multiselect, and marquee box select in `src/renderer/src/hooks/useSelection.ts`
- [x] T044 [US1] Create SelectionBox component for marquee selection rendering in `src/renderer/src/components/layout/SelectionBox.tsx`
- [x] T045 [US1] Create TransformGizmo with move and rotate handles, Shift-constrain in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [x] T046 [US1] Instantiate shared `useSelection()` in Viewport and pass to LayoutCanvas + Sidebar as props in `src/renderer/src/components/Viewport.tsx`
- [x] T047 [US1] Mount SelectionBox and TransformGizmo in LayoutScene in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [x] T048 [US1] Wire TransformGizmo drag callbacks to `useProject().updateEntity(id, patch)` in `src/renderer/src/components/layout/TransformGizmo.tsx`

### Grid Snapping (#93) — Basic snap done, full system planned

- [x] T049 [US1] Implement snap target resolution (grid intersections, entity edges/centers) in `src/renderer/src/lib/snap.ts`
- [x] T050 [US1] Create `useSnapping` hook with global toggle and Shift-to-override in `src/renderer/src/hooks/useSnapping.ts`
- [x] T051 [US1] Integrate snapping into TransformGizmo drag handlers (call `useSnapping().snap()` during drag) in `src/renderer/src/components/layout/TransformGizmo.tsx`

### Snap System Overhaul — See `specs/001-full-roadmap/snap-system-spec.md`

- [ ] T200 [US2] Refactor snap engine for per-axis resolution with multi-point sources (center, edges, corners per entity type) in `src/renderer/src/lib/snap.ts`
- [ ] T201 [US2] Implement screen-space threshold (convert pixel threshold to world units using camera zoom) in `src/renderer/src/lib/snap.ts`
- [ ] T202 [US2] Add alignment snap layer — detect shared X/Y coordinates between dragged and other objects, return guide line data in `src/renderer/src/lib/snap.ts`
- [ ] T203 [US2] Add bin edge snap layer — snap to bin footprint boundaries (left, right, top, bottom edges) in `src/renderer/src/lib/snap.ts`
- [ ] T204 [US2] Implement snap point extraction for all entity types (rectangles: 4 corners + 4 edge midpoints + center; circles: 4 cardinal + center; polygons: vertices + center) in `src/renderer/src/lib/snap.ts`
- [ ] T205 [US2] Create SnapGuides component to render alignment guide lines (dashed lines between aligned points) in `src/renderer/src/components/layout/SnapGuides.tsx`
- [ ] T206 [US2] Add snap configuration UI — toolbar toggles for each snap layer + preferences panel in `src/renderer/src/components/layout/SnapToolbar.tsx`
- [ ] T207 [US2] Integrate per-axis snap into TransformGizmo resize handles in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [ ] T208 [US2] Integrate snap into primitive tool placement (circle, rectangle, polygon tools) in `src/renderer/src/components/primitives/`
- [ ] T209 [US2] Add keyboard shortcut to temporarily disable snap (hold Ctrl) in `src/renderer/src/hooks/useSnapping.ts`

### Sidebar Wiring — Currently display-only, needs mutation callbacks

- [x] T052 [US1] Connect Sidebar entity list to shared `useSelection()` (read selectedIds, highlight, click-to-select) in `src/renderer/src/components/Sidebar.tsx`
- [x] T053 [US1] Connect Sidebar property panel to `useProject().updateEntity(id, patch)` on field changes in `src/renderer/src/components/Sidebar.tsx`

### Geometry Worker (#105) — Lifecycle works, manifold WASM not initialized

- [x] T054 [US1] Create geometry Web Worker with message protocol in `src/renderer/src/workers/geometry.worker.ts`
- [x] T055 [US1] Define WorkerRequest and WorkerResponse TypeScript types in `src/shared/types/worker.ts`
- [x] T056 [US1] Create `useGeometryWorker` hook with request/response promise wrapper and progress tracking in `src/renderer/src/hooks/useGeometryWorker.ts`
- [x] T057 [US1] Initialize manifold WASM in geometry worker startup and handle load failure gracefully in `src/renderer/src/workers/geometry.worker.ts`

### Mesh Boolean Engine (#106) — Stubbed, needs real implementation

- [x] T058 [US1] Implement manifold-based union/subtract/intersect operations in the geometry worker (replace stubs) in `src/renderer/src/workers/geometry.worker.ts`
- [x] T059 [US1] Add Three.js BufferGeometry ↔ manifold Mesh conversion utilities in `src/renderer/src/lib/mesh-convert.ts`

### Extrusion (#102, #103) — Lib works, worker wiring stubbed

- [x] T060 [US1] Implement 2D polygon → 3D solid extrusion (earcut triangulation + Z stitching) in `src/renderer/src/lib/extrude.ts`
- [x] T061 [US1] Add cutter extrusion mode (role='cutter', direction='down') in `src/renderer/src/lib/extrude.ts`
- [x] T062 [US1] Wire extrusion through geometry worker (real postMessage with polygon + depth, receive mesh result) in `src/renderer/src/workers/geometry.worker.ts`
- [x] T063 [US1] Add extrusion UI controls (depth slider, solid/cutter toggle) to entity properties in `src/renderer/src/components/Sidebar.tsx`
- [x] T064 [US1] Connect extrusion UI controls to actual project state mutations in `src/renderer/src/components/Sidebar.tsx`

### Bin Generation (#109) — Lib works, UI is no-op

- [x] T065 [US1] Implement parametric Gridfinity bin mesh generator (walls, floor, lip, magnet/screw recesses) in `src/renderer/src/lib/bin-generator.ts`
- [x] T066 [US1] Add bin creation UI (width/depth/height in grid units, lip toggle, magnet toggle) to sidebar in `src/renderer/src/components/Sidebar.tsx`
- [x] T067 [US1] Wire Sidebar "Generate" button to call bin-generator and store result in project state in `src/renderer/src/components/Sidebar.tsx`

### Bake Action (#107) — Stubbed, needs real pipeline

- [x] T068 [US1] Implement bake action in geometry worker: combine bin mesh + union solids − subtract cutters via manifold boolean pipeline (replace stubs) in `src/renderer/src/workers/geometry.worker.ts`
- [x] T069 [US1] Add Bake button to review sidebar with dirty-state tracking (re-bake needed indicator) in `src/renderer/src/components/Sidebar.tsx`
- [x] T070 [US1] Wire Bake button to generate bin mesh and store BakeResult in project runtime state in `src/renderer/src/components/Sidebar.tsx`
- [x] T071 [US1] Store BakeResult (mesh, timestamp, dirty flag, warnings) in project runtime state in `src/renderer/src/hooks/useProject.tsx`

### 3D Review Mode (#111)

- [x] T072 [US1] Create ReviewCanvas with perspective camera, orbit controls, and directional lighting in `src/renderer/src/components/review/ReviewCanvas.tsx`
- [x] T073 [US1] Create BinPreview rendering baked mesh with material and Z-height slider in `src/renderer/src/components/review/BinPreview.tsx`
- [x] T074 [US1] Wire mode toggle to switch between LayoutCanvas and ReviewCanvas in `src/renderer/src/components/Viewport.tsx`

### STL Export (#112)

- [x] T075 [US1] Implement STL export using Three.js STLExporter from baked mesh in `src/renderer/src/lib/stl-io.ts`
- [x] T076 [US1] Create `export:stl` IPC handler with native save dialog in `src/main/export-handler.ts`
- [x] T077 [US1] Register export IPC channels in preload bridge in `src/preload/index.ts` and `src/preload/index.d.ts`
- [x] T078 [US1] Add Export STL button to review mode sidebar in `src/renderer/src/components/Sidebar.tsx`

### US1 Bug Fixes — User-Reported Issues

> These issues were found by exercising the app interactively. Each represents a broken or missing user flow.

- [x] T149 [US1] Add welcome screen when no project is loaded — prompt user to create new project or open existing file, matching standard creative app UX, in `src/renderer/src/components/WelcomeScreen.tsx` and `src/renderer/src/App.tsx`
- [x] T150 [US1] Fix broken layout canvas pan/zoom — camera props on `<Canvas>` are initial-only in r3f, must use `useThree` inside the canvas to imperatively update camera position and zoom on state change in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [x] T151 [US1] Add on-screen viewport controls for layout canvas — zoom in/out buttons, zoom-to-fit button, and ensure scroll-wheel zoom and right-click/middle-click pan work correctly in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [x] T152 [US1] Fix polygon tool snap-to-close — add proximity detection (snap buffer) around the start vertex so clicking near it closes the polygon, with visual indicator when cursor is within snap range, in `src/renderer/src/components/primitives/PolygonTool.tsx`
- [x] T153 [US1] Merge redundant entity lists in sidebar — remove the read-only EntityList, make the EntityPropertiesPanel list the single entity list with selection, and sync selection state with the canvas via shared `useSelection()` in `src/renderer/src/components/Sidebar.tsx`
- [x] T154 [US1] Fix entity naming to use sequential human-readable names — "Circle 1", "Rectangle 2", etc. by counting existing entities of the same type, in `src/renderer/src/hooks/useProject.tsx`

### US1 Integration Verification

- [x] T079 [US1] Verify full round-trip: select rectangle tool → click canvas → entity appears in entity list → select → move with snap → edit properties in sidebar → save/load preserves state in `src/renderer/src/` — **VERIFIED**: all steps CONNECTED, fixed loadProject file path bug (issue #4)
- [x] T080 [US1] Verify full pipeline: draw rectangle → extrude as cutter → generate bin → bake → switch to review mode → see 3D mesh → export STL in `src/renderer/src/` — **VERIFIED**: all steps CONNECTED, fixed Bake button workerReady gate (issue #2), noted BinPreview.tsx is dead code

**Checkpoint**: User Story 1 complete — full design-to-export pipeline works. User can draw a rectangle, extrude as cutter, generate bin, preview in 3D, and export STL.

---

## Phase 3.5: UX Foundations (Blocking — Before Feature Work)

**Purpose**: Fix fundamental interaction and presentation issues that make the app unusable as a CAD tool. These must be resolved before adding more features — building on a broken UX foundation compounds problems.

**Goal**: The app feels like a real desktop CAD tool: stable layout, responsive controls, real-time property editing, correct pan/zoom, working bin visualization, and consistent design system from echo-libs.

**Independent Test**: Create a new project, draw shapes, edit all properties in real-time via sidebar, pan/zoom naturally, generate a bin that looks correct in review mode, resize the window and reopen to verify persistence.

### Design System — Echo-libs Integration

- [ ] T155 Install `@unstable-studios/ui` package, import base styles and design tokens (CSS variables) in `src/renderer/src/assets/main.css`
- [ ] T156 [P] Replace `ThemeProvider` with echo-libs `ThemeProvider` and add `ThemeToggle` in `src/renderer/src/App.tsx` and `src/renderer/src/components/ui/mode-toggle.tsx`
- [ ] T157 [P] Replace shadcn `Button` with echo-libs `Button` across all components (verify variant mapping: outline, ghost, destructive, etc.)
- [ ] T158 Audit and remove unused shadcn/ui components that are now superseded by echo-libs equivalents in `src/renderer/src/components/ui/`

### Top Bar & Navigation

- [ ] T159 Replace Navbar with echo-libs compound `Navbar`/`NavbarContent`/`NavbarActions`/`NavbarLink` pattern — File, Edit, Help as `NavbarMenu` dropdowns, not outline buttons, in `src/renderer/src/components/Navbar.tsx`
- [ ] T160 Stabilize top bar layout — ViewModeToggle and ToolBar in a fixed center region so they don't shift when toolbar appears/disappears in `src/renderer/src/components/Navbar.tsx`
- [ ] T161 [P] Make project title responsive — truncate with ellipsis or step down font size at narrow widths instead of wrapping in `src/renderer/src/components/Navbar.tsx`
- [ ] T162 [P] Wire or remove non-functional Help menu items (Documentation, Community Forums, Report a Bug) — link to actual URLs or remove placeholders in `src/renderer/src/components/Navbar.tsx`

### Canvas Interaction Fixes

- [ ] T163 Fix pan direction — reverse dx/dy deltas so dragging right scrolls viewport right (like Google Maps / every CAD tool) in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [ ] T164 [P] Reduce scroll wheel zoom sensitivity — lower `ZOOM_STEP` from 1.15 to ~1.06, and normalize across trackpad vs discrete mouse wheel in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [ ] T165 [P] Improve zoom-to-fit: when no entities exist, fit to the Gridfinity grid footprint (bin dimensions) instead of arbitrary defaults in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [ ] T166 Implement dynamic grid sizing — grid overlay grows to encompass all entities plus margin, rather than a fixed extent, in `src/renderer/src/components/layout/GridOverlay.tsx`
- [ ] T167 Add resize handles to selected entities (drag corners/edges to resize circles, rectangles) — CAD-standard interaction for shape editing in `src/renderer/src/components/layout/TransformGizmo.tsx`

### Real-Time Property Editing

- [ ] T168 Convert sidebar entity property inputs from uncontrolled (`defaultValue` + `onBlur`) to controlled (`value` + `onChange`) with real-time entity updates on every keystroke in `src/renderer/src/components/Sidebar.tsx`
- [ ] T169 [P] Make entity name editable via inline text input in sidebar entity list in `src/renderer/src/components/Sidebar.tsx`
- [ ] T170 [P] Make entity dimensions (width, height, diameter) editable with real-time preview update in `src/renderer/src/components/Sidebar.tsx`

### CSG-First Bin Generator (replaces T171) — COMPLETE

> The original bin mesh generator (triangle soup) was replaced with a proper CSG solid model using Manifold WASM. This is the equivalent of gridfinity-rebuilt-openscad's approach: union(feet, bridge, body, lip) then difference(holes, pockets). Bins are solid inserts with pockets cut from the top surface downward. PR #193, closes #106.

- [x] T171 ~~Investigate and fix bin mesh generator~~ → **Superseded**: rewrote as CSG-first builder using Manifold primitives in `src/renderer/src/lib/bin-csg-builder.ts`
- [x] T210 [US1] Create `bin-csg-builder.ts` — pure CSG builder using Manifold primitives: `buildBaseFeet`, `buildBridge`, `buildBody`, `buildLip`, `subtractHoles`, `subtractPockets`, `computeCreaseNormals` in `src/renderer/src/lib/bin-csg-builder.ts`
- [x] T211 [US1] Implement tapered stacking lip following LIP_PROFILE groove spec — annular solid tapers from 2.85mm (bottom) to 0.25mm (top) via hulled annular ring discs in `src/renderer/src/lib/bin-csg-builder.ts`
- [x] T212 [US1] Implement crease-angle normal computation (30° threshold) for proper smooth/hard edge rendering — outputs non-indexed mesh for per-face-vertex normals in `src/renderer/src/lib/bin-csg-builder.ts`
- [x] T213 [US1] Add `CSGBinParams` type to worker protocol, replace `BinCSGGeometry` — passes full bin params including pockets to CSG builder in `src/shared/types/worker.ts`
- [x] T214 [US1] Wire `buildBinCSG` into geometry worker `bake-pockets` handler — all CSG computation off-main-thread in `src/renderer/src/workers/geometry.worker.ts`
- [x] T215 [US1] Create `BinBaker` headless component — auto-bakes bin mesh via CSG worker whenever bin params or pocket entities change in `src/renderer/src/components/Sidebar.tsx`
- [x] T216 [US1] Add pocket system to entities — `PocketConfig` (depth, clearance) on Entity type, `entityToVertices()` utility, pocket controls in sidebar in `src/renderer/src/lib/entity-shapes.ts` and `src/renderer/src/components/Sidebar.tsx`
- [x] T217 [US1] Add schema migrations (v0.2.0 → v0.3.0) for pocket/hole params, `hasDividers` field, entity pocket config in `src/shared/validation/migrations.ts`

### Remaining Extrusion & Visualization

- [ ] T172 Wire `extrudePolygon()` from `extrude.ts` into the entity rendering pipeline — show extruded shapes as 3D preview in review mode when entities have extrusion config in `src/renderer/src/components/review/ReviewCanvas.tsx`
- [ ] T173 [P] Add visual feedback in layout mode when "Generate Bin" is clicked — show bin footprint outline on the layout canvas, not just silently set bakeResult for review mode, in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Unit System

- [ ] T174 Define unit types (mm, cm, inch) and conversion utilities — store all values internally in mm, convert at presentation layer only, in `src/shared/types/units.ts`
- [ ] T175 Add unit selector to project settings (dropdown: mm, cm, inch) and persist in project file in `src/shared/types/project.ts` and `src/renderer/src/components/settings/GridfinitySettings.tsx`
- [ ] T176 Apply unit formatting to all displayed measurements (sidebar properties, grid labels, tooltip values) — show values in selected unit with automatic conversion in `src/renderer/src/lib/unit-format.ts` and `src/renderer/src/components/Sidebar.tsx`

### Preferences Modal

- [ ] T177 Create Preferences modal dialog accessible from File menu (or app menu on macOS) — tabbed layout with General, Units, and Gridfinity sections, in `src/renderer/src/components/settings/PreferencesModal.tsx`
- [ ] T178 Move existing GridfinitySettings panel into the Gridfinity tab of the Preferences modal, add Unit selector to Units tab, in `src/renderer/src/components/settings/PreferencesModal.tsx`
- [ ] T179 [P] Wire Preferences menu item in File menu (or Edit menu per platform convention) and add Cmd+, keyboard shortcut in `src/renderer/src/components/Navbar.tsx`

### Window Management

- [ ] T180 Increase default window size from 900x670 to at least 1280x800 in `src/main/index.ts`
- [ ] T181 Persist window bounds (position + size) across sessions using `electron-store` or file-based storage — restore on next launch in `src/main/index.ts`

### UX Foundations Verification

- [ ] T182 Verify end-to-end: create project → draw shapes → edit all properties in real-time → pan/zoom feels natural → generate bin → bin looks correct in review → resize window → reopen app and verify window size persisted → open preferences → change units → verify all values update

**Checkpoint**: UX foundations solid — the app behaves like a real CAD tool with consistent design system, stable layout, responsive controls, and correct visualization. Feature work can proceed on a sound base.

---

## Phase 4: User Story 3 — Iterate on Design with Undo/Redo (Priority: P1)

**Goal**: Undo/redo works for all project mutations — entity CRUD, transforms, parameter changes, grouping.

**Independent Test**: Create entity, move it, change parameters, undo each step, verify state reverts correctly.

**Issues**: #84 (integration across all mutation points from US1)

### Tests for User Story 3

- [ ] T081 [P] [US3] Write integration tests for undo across entity create/delete/move/rotate/parameter-edit in `src/renderer/src/lib/__tests__/undo-integration.test.ts`

### Implementation for User Story 3

- [ ] T082 [US3] Add CreateEntityCommand and DeleteEntityCommand to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T083 [US3] Add MoveCommand and RotateCommand (captures old/new transform) to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T084 [US3] Add UpdateParameterCommand (captures old/new values for any entity field) to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T085 [US3] Integrate undo commands into all primitive creation tools (circle, rectangle, polygon) in `src/renderer/src/components/primitives/CircleTool.tsx`, `RectangleTool.tsx`, `PolygonTool.tsx`
- [ ] T086 [US3] Integrate undo commands into TransformGizmo move/rotate operations in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [ ] T087 [US3] Integrate undo commands into extrusion and bin parameter changes in `src/renderer/src/components/Sidebar.tsx`
- [ ] T088 [US3] Clear undo history on project load/new in `src/renderer/src/hooks/useProject.tsx`
- [ ] T089 [US3] Add undo/redo status to navbar (showing last action label, disabled state) in `src/renderer/src/components/Navbar.tsx`

**Checkpoint**: User Story 3 complete — all mutations from US1 are undoable/redoable via Cmd+Z / Cmd+Shift+Z.

---

## Phase 5: User Story 2 — Socket Tray with Repeating Pattern (Priority: P2)

**Goal**: Import an SVG socket outline, create a linear pattern with size-aware spacing, place in a multi-unit bin, and export.

**Independent Test**: Import SVG, create pattern with 5 instances at size-aware pitch, verify spacing matches bounding box + gap.

**Issues**: #91, #94, #95, #96, #97, #98, #99, #100, #101, #104

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T090 [P] [US2] Write tests for SVG path parsing (simple paths, compound paths, transforms, degenerate cases) in `src/renderer/src/lib/__tests__/svg-import.test.ts`
- [ ] T091 [P] [US2] Write tests for linear pattern spacing (constant pitch, size-aware, explicit array) in `src/renderer/src/lib/__tests__/pattern.test.ts`
- [ ] T092 [P] [US2] Write tests for STL import (binary, ASCII, mesh entity creation) in `src/renderer/src/lib/__tests__/stl-io.test.ts`

### SVG Import (#91)

- [ ] T093 [US2] Implement SVG path parser using DOMParser + path segment → polygon conversion in `src/renderer/src/lib/svg-import.ts`
- [ ] T094 [US2] Create `import:svg` IPC handler with native file dialog (filter: .svg) in `src/main/import-handler.ts`
- [ ] T095 [US2] Register import IPC channels in preload bridge in `src/preload/index.ts` and `src/preload/index.d.ts`
- [ ] T096 [US2] Add Import SVG menu action and integrate with entity creation (onPlace → addEntity) in `src/renderer/src/components/Navbar.tsx`

### STL Import (#104)

- [ ] T097 [US2] Implement STL import using Three.js STLLoader, create MeshEntity in `src/renderer/src/lib/stl-io.ts`
- [ ] T098 [US2] Create `import:stl` IPC handler with native file dialog (filter: .stl) in `src/main/import-handler.ts`
- [ ] T099 [US2] Add Import STL menu action in `src/renderer/src/components/Navbar.tsx`
- [ ] T100 [US2] Render imported STL meshes in layout mode (2D footprint projection) and review mode (full 3D) in `src/renderer/src/components/layout/EntityRenderer.tsx`

### Group Entities (#94)

- [ ] T101 [US2] Implement group/ungroup logic with hierarchical transforms in project state in `src/renderer/src/hooks/useProject.tsx`
- [ ] T102 [US2] Add Group/Ungroup commands to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T103 [US2] Add Group/Ungroup keyboard shortcuts (Cmd+G / Cmd+Shift+G) and menu items in `src/renderer/src/components/Navbar.tsx`

### Align & Distribute Tools (#95, #96)

- [ ] T104 [P] [US2] Implement alignment actions (left, right, top, bottom, center-h, center-v) for selected entities in `src/renderer/src/lib/align.ts`
- [ ] T105 [P] [US2] Implement distribute actions (equal gaps X, equal gaps Y, optional grid-unit snap) for selected entities in `src/renderer/src/lib/distribute.ts`
- [ ] T106 [US2] Add align/distribute toolbar buttons (visible when 2+ entities selected) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Linear Pattern Generator (#97)

- [ ] T107 [US2] Implement linear pattern generator creating N instances along X or Y axis in `src/renderer/src/lib/pattern.ts`
- [ ] T108 [US2] Create PatternPanel UI (axis, count, spacing mode selector) in `src/renderer/src/components/patterns/PatternPanel.tsx`
- [ ] T109 [US2] Render pattern instances as instanced entities in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`
- [ ] T110 [US2] Integrate pattern generator with undo system (CreatePatternCommand) in `src/renderer/src/lib/undo.ts`

### Pattern Spacing Modes (#98, #99, #100)

- [ ] T111 [US2] Implement constant-pitch spacing mode (fixed distance between instances) in `src/renderer/src/lib/pattern.ts`
- [ ] T112 [US2] Implement size-aware spacing mode (bounding box + configurable gap) in `src/renderer/src/lib/pattern.ts`
- [ ] T113 [US2] Implement explicit-array spacing mode (per-instance position list) in `src/renderer/src/lib/pattern.ts`
- [ ] T114 [US2] Add spacing mode UI controls to PatternPanel (pitch input, gap input, position list editor) in `src/renderer/src/components/patterns/PatternPanel.tsx`

### Break Pattern Instance (#101)

- [ ] T115 [US2] Implement break-instance action: detach one generated instance into a manual entity in `src/renderer/src/lib/pattern.ts`
- [ ] T116 [US2] Add Break Instance context menu action for pattern instances in `src/renderer/src/components/layout/EntityRenderer.tsx`

**Checkpoint**: User Story 2 complete — SVG import, patterns with all spacing modes, groups, align/distribute all working. Socket tray workflow functional.

---

## Phase 6: User Story 4 — Multi-Bin Layout (Priority: P3)

**Goal**: Design a drawer organizer with multiple bins, use grid overlay and alignment to position precisely, batch export all bins.

**Independent Test**: Create 3 bins of different sizes, align to grid, export all as batch STL with sensible filenames.

**Issues**: #113, #114, #115, #119, #110

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T117 [P] [US4] Write tests for 3MF writer (valid ZIP structure, XML schema, mesh data) in `src/renderer/src/lib/__tests__/threemf-writer.test.ts`
- [ ] T118 [P] [US4] Write tests for collision detection (overlapping footprints, non-overlapping, edge-touching) in `src/renderer/src/lib/__tests__/collision.test.ts`
- [ ] T119 [P] [US4] Write tests for auto-wrap (minimal grid-aligned bin size for selection) in `src/renderer/src/lib/__tests__/auto-wrap.test.ts`

### Batch Export (#113)

- [ ] T120 [US4] Create `export:batch` IPC handler with directory dialog and filename pattern in `src/main/export-handler.ts`
- [ ] T121 [US4] Add batch export UI (all bins / selected bins, filename pattern, format selector) in `src/renderer/src/components/export/ExportPanel.tsx`
- [ ] T122 [US4] Wire ExportPanel into sidebar Export tab in `src/renderer/src/components/Sidebar.tsx`

### 3MF Export (#119)

- [ ] T123 [US4] Implement minimal 3MF writer (ZIP via jszip, XML model file, mesh data) in `src/renderer/src/lib/threemf-writer.ts`
- [ ] T124 [US4] Create `export:3mf` IPC handler with native save dialog in `src/main/export-handler.ts`
- [ ] T125 [US4] Add 3MF format option to export panel and single-export toolbar in `src/renderer/src/components/export/ExportPanel.tsx`

### Collision Detection (#115)

- [ ] T126 [US4] Implement 2D footprint overlap detection for entities within a bin in `src/renderer/src/lib/collision.ts`
- [ ] T127 [US4] Render collision warnings as visual indicators (red outlines) in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`

### Gridfinity Keep-Out Visualization (#114)

- [ ] T128 [US4] Calculate keep-out regions from GridfinityConfig (magnet circles, screw holes, lip inset) in `src/renderer/src/lib/keep-out.ts`
- [ ] T129 [US4] Render keep-out zones as semi-transparent overlays in layout and review modes in `src/renderer/src/components/layout/GridOverlay.tsx`

### Auto-Wrap Selection into Bin (#110)

- [ ] T130 [US4] Implement auto-wrap: compute minimal grid-aligned bin dimensions for selected entities with margins in `src/renderer/src/lib/auto-wrap.ts`
- [ ] T131 [US4] Add "Auto-wrap" action button (visible when entities selected without a bin) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

**Checkpoint**: User Story 4 complete — multiple bins, batch export (STL + 3MF), collision warnings, keep-out visualization, auto-wrap all working.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Analysis, validation, quality-of-life improvements that affect multiple user stories

### Wall/Floor Thickness Analysis (#116)

- [ ] T132 [P] Write tests for thickness analysis (thin wall detection, thin floor detection, within-tolerance passes) in `src/renderer/src/lib/__tests__/analysis.test.ts`
- [ ] T133 Implement post-bake mesh analysis for thin walls and thin floor regions in `src/renderer/src/lib/analysis.ts`
- [ ] T134 Add 'analyze' message type to geometry worker for off-thread analysis in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T135 Display analysis warnings in review mode (highlight thin regions, warning panel) in `src/renderer/src/components/review/BinPreview.tsx`

### Deterministic Output Tests (#117)

- [ ] T136 Write deterministic output tests: identical project inputs → identical baked meshes (vertex-level tolerance comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`
- [ ] T137 Write deterministic export tests: identical baked meshes → identical STL/3MF output (binary comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`

### Example Projects (#118)

- [ ] T138 [P] Create example project: simple socket tray (SVG import + pattern) in `examples/socket-tray.gfstudio`
- [ ] T139 [P] Create example project: mixed asset tray (STL + 2D primitives) in `examples/mixed-assets.gfstudio`
- [ ] T140 [P] Create example project: multi-bin drawer organizer in `examples/drawer-organizer.gfstudio`

### Multi-Bin Packing (#120)

- [ ] T141 Write tests for multi-bin packing (partition by area, keep groups together, grid alignment) in `src/renderer/src/lib/__tests__/packing.test.ts`
- [ ] T142 Implement multi-bin packing algorithm: partition entities into grid-aligned bins with group constraints in `src/renderer/src/lib/packing.ts`
- [ ] T143 Add "Auto-pack" action in layout mode that creates bins from packing result in `src/renderer/src/components/layout/LayoutCanvas.tsx`

### Contextual Hints System

- [ ] T149a Create floating hint card component (anchored to bottom of viewport, semi-transparent, shows tool-specific guidance and keyboard shortcuts) in `src/renderer/src/components/HintCard.tsx`
- [ ] T149b Add hint content registry mapping each tool/mode to its hint text and shortcuts (e.g., "Click to place center, drag to set radius" for circle tool) in `src/renderer/src/lib/hints.ts`
- [ ] T149c Mount HintCard in App layout, connect to `useAppMode().activeTool` to show context-specific hints in `src/renderer/src/App.tsx`

### Final Validation

- [ ] T144 Run `pnpm typecheck` and fix any type errors across all new files
- [ ] T145 Run `pnpm lint` and fix any linting issues across all new files
- [ ] T146 Run `pnpm format` and fix any formatting issues across all new files
- [ ] T147 Run full test suite and verify all tests pass
- [ ] T148 Run quickstart.md validation: verify end-to-end workflow (draw → extrude → bake → export) works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — COMPLETE
- **Foundational (Phase 2)**: Depends on Setup — COMPLETE
- **US1 (Phase 3)**: Depends on Foundational — COMPLETE
- **UX Foundations (Phase 3.5)**: Depends on US1 — fixes interaction/presentation before feature work continues
- **US3 (Phase 4)**: Depends on UX Foundations — undo integrates across mutation points that Phase 3.5 may change (controlled inputs, resize handles)
- **US2 (Phase 5)**: Depends on UX Foundations — SVG import and patterns build on corrected canvas interaction and unit system
- **US4 (Phase 6)**: Depends on US1 + UX Foundations — batch export, multi-bin layout
- **Polish (Phase 7)**: Depends on all prior phases — cross-cutting analysis, hints, examples

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) — COMPLETE
- **UX Foundations**: Depends on US1 — fixes interaction issues before more features are built
- **User Story 3 (P1)**: Depends on UX Foundations — undo wraps mutation points that may change in Phase 3.5
- **User Story 2 (P2)**: Depends on UX Foundations — patterns/SVG build on corrected canvas and unit system
- **User Story 4 (P3)**: Depends on US1 + UX Foundations — needs export infrastructure, review mode, bin generation

### Critical Path for US1 Integration

The US1 integration tasks have this internal dependency order:

```
T031 (Entity mutation API)
  ├── T041 (Mount tools in LayoutScene)
  │     └── T042 (Wire tool onPlace → addEntity)
  ├── T046 (Instantiate useSelection in Viewport)
  │     ├── T047 (Mount SelectionBox + TransformGizmo)
  │     │     ├── T048 (Wire TransformGizmo → updateEntity)
  │     │     └── T051 (Integrate snapping into TransformGizmo)
  │     └── T052 (Wire Sidebar entity list to selection)
  │           └── T053 (Wire Sidebar properties to updateEntity)
  ├── T057 (Init manifold WASM)
  │     ├── T058 (Implement boolean operations)
  │     │     └── T068 (Implement bake pipeline)
  │     └── T062 (Wire extrusion through worker)
  │           └── T064 (Connect extrusion UI to worker)
  └── T067 (Wire Generate button)
        └── T070 (Wire Bake button → worker → BakeResult)
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle III)
- Types/schemas before implementation logic
- Core lib functions before UI components
- Worker integration before UI controls
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1** — COMPLETE
**Phase 2** — COMPLETE
**Phase 3** — COMPLETE

**Phase 3.5** (UX Foundations):
- T156 + T157 in parallel (ThemeProvider and Button replacements are independent files)
- T161 + T162 in parallel (responsive title and help menu are independent)
- T164 + T165 in parallel (zoom sensitivity and zoom-to-fit are different functions)
- T169 + T170 in parallel (name editing and dimension editing are independent UI changes)
- T173 in parallel with T171 (layout feedback vs bin mesh fix are different subsystems)

**Phase 5** (within US2):
- T090, T091, T092 — all test files in parallel
- T104, T105 — align and distribute in parallel (different files)

**Phase 6** (within US4):
- T117, T118, T119 — all test files in parallel
- T138, T139, T140 — example projects in parallel

**Cross-phase parallelism**:
- After Phase 3.5, US3 and US2 can proceed in parallel (undo vs import/patterns are different concerns)
- After US1, US4 can proceed in parallel with US2 (export vs import are independent)

---

## Parallel Example: Phase 3.5 (UX Foundations)

```bash
# After T155 (echo-libs installed), launch component replacements in parallel:
Task: T156 "Replace ThemeProvider with echo-libs"
Task: T157 "Replace shadcn Button with echo-libs Button"

# After T159 (Navbar restructured), launch independent fixes:
Task: T161 "Responsive title text"
Task: T162 "Wire or remove Help menu items"

# Canvas fixes can all run in parallel (different functions/files):
Task: T163 "Fix pan direction"
Task: T164 "Reduce zoom sensitivity"
Task: T165 "Improve zoom-to-fit default"

# Property editing improvements in parallel:
Task: T169 "Inline name editing"
Task: T170 "Dimension editing with live preview"
```

## Parallel Example: User Story 2

```bash
# Launch all tests for US2 together:
Task: T090 "Write SVG import tests in src/renderer/src/lib/__tests__/svg-import.test.ts"
Task: T091 "Write pattern spacing tests in src/renderer/src/lib/__tests__/pattern.test.ts"
Task: T092 "Write STL import tests in src/renderer/src/lib/__tests__/stl-io.test.ts"

# Launch align and distribute in parallel:
Task: T104 "Implement alignment actions in src/renderer/src/lib/align.ts"
Task: T105 "Implement distribute actions in src/renderer/src/lib/distribute.ts"
```

---

## Implementation Strategy

### Immediate Priority: UX Foundations (Phase 3.5) — Partially Complete

US1 is complete. The CSG-first bin generator (T171/T210–T217) is done — bins are proper manifold-valid solids with pockets cut from the top surface. Remaining UX work:

1. **T155–T158**: Echo-libs integration — consistent design system
2. **T159–T162**: Top bar & navigation — stable layout, tab-style menus
3. **T163–T167**: Canvas interaction — pan direction, zoom sensitivity, resize handles
4. **T168–T170**: Real-time property editing — controlled inputs
5. **T172–T173**: Remaining visualization — extrusion preview, layout feedback
6. **T174–T176**: Unit system — metric internal, presentation-layer conversion
7. **T177–T179**: Preferences modal — central settings hub
8. **T180–T181**: Window management — larger default, persist bounds
9. **T182**: End-to-end verification

### MVP First

1. ~~Complete Phase 1: Setup (T001–T005)~~ DONE
2. ~~Complete Phase 2: Foundational (T006–T025)~~ DONE
3. ~~Complete Phase 3: User Story 1 (T026–T080, T149–T154)~~ DONE
4. **Complete Phase 3.5: UX Foundations (T155–T182)** — NEXT
5. **STOP and VALIDATE**: App feels like a real CAD tool before adding more features
6. Continue with US3/US2/US4/Polish

### Incremental Delivery

1. ~~Setup + Foundational → Foundation ready~~ DONE
2. ~~US1 integration → Design-to-export pipeline works~~ DONE
3. **UX Foundations → App feels like a real CAD tool (IN PROGRESS — CSG bin generator done, remaining UX work pending)**
4. Add US3 → Test independently → Demo (Undo/redo for all mutations)
5. Add US2 → Test independently → Demo (SVG import + patterns for socket trays)
6. Add US4 → Test independently → Demo (Multi-bin layouts with batch export)
7. Add Polish → Full product with analysis, hints, examples, packing

### Parallel Team Strategy

With multiple developers:

1. ~~Team completes Setup + Foundational + US1 together~~ DONE
2. **Immediate — Phase 3.5 (UX Foundations)**:
   - Developer A: Echo-libs integration + Navbar restructure (T155–T162)
   - Developer B: Canvas interaction fixes + property editing (T163–T170)
   - Developer C: Bin/extrusion viz + unit system + preferences (T171–T179)
3. After UX Foundations:
   - Developer A: User Story 3 (undo integration)
   - Developer B: User Story 2 (SVG import + patterns)
   - Developer C: User Story 4 (batch export, multi-bin)
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
- **Integration anti-pattern**: Do NOT mark a component task as done without verifying it is mounted in the component tree and connected to state (see plan.md Integration Architecture)
- **UX gate**: Before marking any phase complete, run the checklist in `ux-interaction-spec.md` Part 6. Every applicable item must pass.
- **Interaction matrix**: `ux-interaction-spec.md` Part 2 defines what verb × noun combinations must work. "Required" cells must be functional before proceeding to the next phase.
