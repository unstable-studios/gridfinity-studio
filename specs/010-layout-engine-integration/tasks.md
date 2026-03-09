# Tasks: Layout Engine Integration (Clean Slate)

**Feature**: 010-layout-engine-integration

## Phase 1: Engine as Source of Truth

- [x] T001: Mount `LayoutEngineProvider` in Viewport layout mode branch, replacing the `<LayoutCanvas>` mount.
- [x] T002: Strip entity mutations from `useProject.ts`. Also deleted old R3F layout components (LayoutCanvas, TransformGizmo, etc.).
- [x] T003: Strip bin mutations from `useProject.ts`. Bins will live as LayoutGroups in the engine.
- [x] T004: Strip hand-rolled undo/redo from `useProject.ts`. Undo/redo is now engine-snapshot-based.
- [x] T005: Promote sandbox undo/redo to production — `useEngineUndoRedo(engine)` hook with keyboard shortcuts.
- [x] T006: Wire `engine.toSnapshot()` into project save via `useProjectEngineSync`.
- [x] T007: Wire `engine.loadSnapshot()` from project load via `useProjectEngineSync`.
- [x] T008: Update `ProjectData` schema to v0.5.0 — `layoutSnapshot` required, typed `LayoutShapeData`/`LayoutGroupData`.
- [x] T009: Write v0.4.0 → v0.5.0 migration converting entities→shapes and bins→groups.
- [x] T010: Type `LayoutSnapshotData` properly with `LayoutShapeData[]` and `LayoutGroupData[]`.
- [ ] T011: Smoke test — create new project, shapes render in engine. Open existing v0.4.0 project, migration runs, shapes appear. Save and reload, data round-trips.

## Phase 2: Bin Groups

- [x] T012: Define `BinMetadata` interface — `{ widthUnits, depthUnits, heightUnits, hasLip }`. Global gridfinity config provides magnet/screw hole settings.
- [x] T013: Implement bin creation via `engine.createGroup()` — wire the existing grid picker / "Add Bin" UI to create a `LayoutGroup` with `BinMetadata` and correct dimensions (`widthUnits * baseUnit`).
- [x] T014: Bin visual rendering — groups render as rounded rectangles with background fill/stroke via engine adapters.
- [x] T016: Bin selection — clicking a group selects the bin. Sidebar shows bin properties when a group is selected, shape properties when a shape is selected.
- [x] T015: Bin detail artwork — render magnet/screw hole circles and lip-inset boundary as non-interactive decorations within bin groups.
  - [x] T015-spike: Initial implementation with direct `_objects` manipulation (checkpoint commit)
  - [x] T015a: Define `GroupRenderer` interface (`group-renderer.ts`)
  - [x] T015b: Implement `FabricGroupRenderer` — extract all Fabric group internals
  - [x] T015c: Implement `KonvaGroupRenderer` — extract all Konva group internals
  - [x] T015d: Simplify engine group methods to thin delegators
  - [x] T015e: Verify all contract tests pass (19 decoration + 42 engine contract)
- [x] T017: Bin drag with grid snap — groups snap to grid via lower-left corner. Single-select snaps live in both engines. Fabric multi-select snaps live via ActiveSelection; Konva multi-select snaps on dragend (Transformer limitation).
- [ ] T018: Bin resize — drag bin edges to change `widthUnits`/`depthUnits`. Grid-unit-quantized resize. (Sidebar resize works; drag-to-resize not yet implemented.)
- [ ] T019: Bin collision detection — prevent bin overlaps during drag/resize.
- [ ] T020: Smoke test — create bins via grid picker, bins render with correct Gridfinity styling, drag/resize bins, collision rejection works, bins persist across save/load.

## Phase 3: Drawing Tools

- [x] T021: Create `DrawingToolLayer` component — transparent DOM overlay active when tool is selected. Captures pointer events, converts to world coordinates via `engine.getViewport()`.
- [x] T022: Implement rectangle tool — click-drag to define corners, preview as temporary engine shape, release to place. Calls `engine.addShape({ type: 'rect', ... })`. Assigns to containing group if placed inside a bin.
- [x] T023: Implement circle tool — click for center, drag for radius preview, release to place. Creates `{ type: 'circle', radiusX, radiusY }`.
- [x] T024: Implement polygon tool — multi-click vertex placement, close-snap detection, double-click/Enter to finish. Creates `{ type: 'polygon', points }`.
- [x] T025: Wire pocket metadata — shapes created inside a bin group get `metadata: { pocket: { depth, clearance } }` with defaults computed from bin height.
- [ ] T026: Smoke test — draw all shape types, verify they appear in engine, are selectable, belong to correct group, survive save/load.

## Phase 4: CSG Pipeline Adapter

- [ ] T027: Create `layoutShapeToPocketSpec()` — converts `LayoutShape` geometry to `PocketSpec` (Float32Array vertices + depth + position relative to bin center). Handles rect, circle, polygon. SVG path and mesh import deferred.
- [ ] T028: Create `layoutGroupToCSGBinParams()` — reads `BinMetadata` from `LayoutGroup.metadata` + global `GridfinityConfig` to produce `CSGBinParams`. Gathers child shapes as `PocketSpec[]`.
- [ ] T029: Wire bake flow — engine-based BinBaker reads groups/shapes from engine, converts to CSGBinParams, sends to worker. Replaces old entity-based BinBaker (now deleted).
- [ ] T030: Verify 3D preview — `ReviewCanvas` renders bake results. Updated to iterate bakeResults directly (no longer depends on old Bin type).
- [ ] T031: Run existing CSG tests — `bin-generator.test.ts` tests the builder directly with `CSGBinParams`. Add a new test that goes LayoutShape → PocketSpec → CSGBinParams to verify the adapter.
- [ ] T032: Verify export — STL and 3MF export reads from bake results. End-to-end: draw shapes → bake → export → inspect file.

## Phase 5: Sidebar Rebuild

- [x] T033: Sidebar reads from engine — shape list reads `engine.getAllShapes()`, group list reads `engine.getAllGroups()`. Subscribe to engine events for live updates.
- [x] T034: Shape property editing — editing position in sidebar calls `engine.updateShape(id, patch)`.
- [x] T035: Bin property editing — editing bin W/D/H and lip in sidebar calls `engine.updateGroup(id, patch)` with updated BinMetadata.
- [ ] T036: Shape-to-bin assignment — when a shape is dragged into/out of a bin, call `engine.addToGroup()`/`engine.removeFromGroup()`. Sidebar reflects group membership.
- [x] T037: Delete key — delete selected shapes/groups. Already wired in LayoutViewport and Sidebar.
- [ ] T038: Smoke test — select shape in canvas, sidebar shows its properties. Edit properties, canvas updates. Same for bins. Delete works.

## Phase 6: Teardown (old entity/bin system)

- [x] T039: Delete `src/renderer/src/components/layout/` (done in earlier commit).
- [x] T040: Delete `src/renderer/src/components/primitives/` — CircleTool, RectangleTool, PolygonTool.
- [x] T041: Delete entity system types — removed Entity union, BaseEntity, all entity interfaces, Group, Generator, Bin from project.ts. Removed entities/groups/generators/bins from ProjectData.
- [x] T042: Delete old hooks — useSelection, useSnapping.
- [x] T043: Delete old utilities — entity-shapes.ts, entity-geometry.ts, extrude.ts, z-layers.ts, snap.ts, auto-wrap.ts, collision.ts.
- [x] T044: Delete old tests — entity-mutations, store-operations, selection, entity-integration, auto-wrap, collision, snap, extrude tests.
- [x] T045: Clean up imports — removed all dead imports. Typecheck + lint pass.
- [x] T046: Update project validator — simplified to validate layoutSnapshot structure, removed entity/bin validation.
- [ ] T047: Update CLAUDE.md — new architecture description, removed components, updated data flow.
- [ ] T048: Final verification — run full test suite, typecheck, lint. Interactive smoke test.

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 | T001–T011 | Done (except T011 smoke test) |
| 2 | T012–T020 | Partially done (T012-T014, T016-T017) |
| 3 | T021–T026 | T021-T025 done, T026 smoke test remaining |
| 4 | T027–T032 | Not started |
| 5 | T033–T038 | Partially done (T033-T035, T037) |
| 6 | T039–T048 | Done (except T047 CLAUDE.md, T048 final) |
