# Tasks: Layout Engine Integration (Clean Slate)

**Feature**: 010-layout-engine-integration

## Phase 1: Engine as Source of Truth

- [ ] T001: Mount `LayoutEngineProvider` in Viewport layout mode branch, replacing the `<LayoutCanvas>` mount. Engine type from `useAppMode().engineType`. Grid config from `GridfinityConfig.baseUnit`. Theme from `resolveColors(resolvedTheme)`.
- [ ] T002: Strip entity mutations from `useProject.ts` — remove `addEntity`, `updateEntity`, `moveEntity`, `removeEntity`, and the entity array from `ProjectState`. Keep file ops, gridfinity config, project metadata, bake results.
- [ ] T003: Strip bin mutations from `useProject.ts` — remove `addBin`, `updateBin`, `moveBin`, `removeBin`, and the bins array from `ProjectState`. Bins will live as LayoutGroups in the engine.
- [ ] T004: Strip hand-rolled undo/redo from `useProject.ts` — remove `_undoStack`, `_redoStack`, `pushUndo`, `startDrag`/`endDrag`, `undo`/`redo`. Undo/redo is now engine-snapshot-based (already working in sandbox's `EngineToolbar`).
- [ ] T005: Promote sandbox undo/redo to production — extract the undo/redo stack logic from `Viewport.tsx`'s `EngineToolbar` into a reusable `useEngineUndoRedo(engine)` hook. Wire Ctrl+Z / Ctrl+Shift+Z globally for layout mode.
- [ ] T006: Wire `engine.toSnapshot()` into project save — `useProjectEngineSync.saveWithSnapshot()` already does this. Ensure it's called from Navbar save actions.
- [ ] T007: Wire `engine.loadSnapshot()` from project load — `useProjectEngineSync` already handles this. Verify it fires correctly when a `.gfstudio` file is opened.
- [ ] T008: Update `ProjectData` schema to v0.5.0 — make `layoutSnapshot` required (not optional). Remove `entities`, `bins`, `groups`, `generators` arrays. Update `createEmptyProject()` to include an empty `LayoutSnapshot`.
- [ ] T009: Write v0.4.0 → v0.5.0 migration — convert old `entities[]` to `LayoutShape[]` and old `bins[]` to `LayoutGroup[]` (with metadata). Add to `migrations.ts`. Handle all entity type variants.
- [ ] T010: Type `LayoutSnapshotData` properly — replace `Record<string, unknown>[]` with actual `LayoutShape[]` and `LayoutGroup[]` types in `src/shared/types/project.ts`. Remove unsafe casts in `useProjectEngineSync`.
- [ ] T011: Smoke test — create new project, shapes render in engine. Open existing v0.4.0 project, migration runs, shapes appear. Save and reload, data round-trips.

## Phase 2: Bin Groups

- [ ] T012: Define `BinMetadata` interface — `{ widthUnits, depthUnits, heightUnits, hasLip }`. Global gridfinity config provides magnet/screw hole settings.
- [ ] T013: Implement bin creation via `engine.createGroup()` — wire the existing grid picker / "Add Bin" UI to create a `LayoutGroup` with `BinMetadata` and correct dimensions (`widthUnits * baseUnit`).
- [ ] T014: Bin visual rendering — ensure groups render as rounded rectangles with Gridfinity styling (fill, stroke, optional lip line). May need to extend engine adapters' group rendering or add non-interactive child shapes for lip line.
- [ ] T015: Keep-out zone rendering — render magnet/screw hole circles and lip-inset annular ring as non-interactive shapes within the group. Reuse `computeKeepOut()` geometry, convert output to engine shapes.
- [ ] T016: Bin selection — clicking a group selects the bin. Engine already supports group selection. Wire `selectionChanged` to update sidebar context (show bin properties when a group is selected, shape properties when a shape is selected).
- [ ] T017: Bin drag with grid snap — groups should snap to grid positions. May need to handle this in the engine's snap-to-grid handler or at the event layer.
- [ ] T018: Bin resize — drag bin edges to change `widthUnits`/`depthUnits`. This is grid-unit-quantized resize, not free resize. May need a custom resize handler that snaps to baseUnit increments and updates group metadata.
- [ ] T019: Bin collision detection — prevent bin overlaps during drag/resize. Reuse `binOverlapsAny` logic from `collision.ts`, adapted to read group positions from engine.
- [ ] T020: Smoke test — create bins via grid picker, bins render with correct Gridfinity styling, drag/resize bins, collision rejection works, bins persist across save/load.

## Phase 3: Drawing Tools

- [ ] T021: Create `DrawingToolLayer` component — transparent DOM overlay active when tool is selected. Captures pointer events, converts to world coordinates via `engine.getViewport()`.
- [ ] T022: Implement rectangle tool — click-drag to define corners, preview as temporary engine shape, release to place. Calls `engine.addShape({ type: 'rect', ... })`. Assigns to containing group if placed inside a bin.
- [ ] T023: Implement circle tool — click for center, drag for radius preview, release to place. Creates `{ type: 'circle', radiusX, radiusY }`.
- [ ] T024: Implement polygon tool — multi-click vertex placement, close-snap detection, double-click/Enter to finish. Creates `{ type: 'polygon', points }`.
- [ ] T025: Wire pocket metadata — shapes created inside a bin group get `metadata: { pocket: { depth, clearance } }` with defaults computed from bin height.
- [ ] T026: Smoke test — draw all shape types, verify they appear in engine, are selectable, belong to correct group, survive save/load.

## Phase 4: CSG Pipeline Adapter

- [ ] T027: Create `layoutShapeToPocketSpec()` — converts `LayoutShape` geometry to `PocketSpec` (Float32Array vertices + depth + position relative to bin center). Handles rect, circle, polygon. SVG path and mesh import deferred.
- [ ] T028: Create `layoutGroupToCSGBinParams()` — reads `BinMetadata` from `LayoutGroup.metadata` + global `GridfinityConfig` to produce `CSGBinParams`. Gathers child shapes as `PocketSpec[]`.
- [ ] T029: Wire sidebar bake flow — replace entity-based bake trigger with engine-based. Read shapes from `engine.getShape()` for group children, convert to pocket specs, send to worker.
- [ ] T030: Verify 3D preview — `ReviewCanvas` and `BinPreview` render bake results (mesh arrays). These components read from Zustand `bakeResults` which is unchanged. Verify meshes look correct.
- [ ] T031: Run existing CSG tests — `bin-generator.test.ts` tests the builder directly with `CSGBinParams`. Should pass unchanged. Add a new test that goes LayoutShape → PocketSpec → CSGBinParams to verify the new adapter.
- [ ] T032: Verify export — STL and 3MF export reads from bake results. Should work unchanged. End-to-end test: draw shapes → bake → export → inspect file.

## Phase 5: Sidebar Rebuild

- [ ] T033: Sidebar reads from engine — shape list reads `engine.getAllShapes()`, group list reads `engine.getAllGroups()`. Subscribe to engine events for live updates.
- [ ] T034: Shape property editing — editing position/dimensions/fill/stroke in sidebar calls `engine.updateShape(id, patch)`. Replace Zustand `updateEntity` calls.
- [ ] T035: Bin property editing — editing bin name, height, lip in sidebar calls `engine.updateGroup(id, patch)` with updated metadata. Gridfinity-specific fields update `BinMetadata`.
- [ ] T036: Shape-to-bin assignment — when a shape is dragged into/out of a bin, call `engine.addToGroup()`/`engine.removeFromGroup()`. Sidebar reflects group membership.
- [ ] T037: Delete key — delete selected shapes via `engine.removeShape()`, selected groups via `engine.removeGroup()`. Already have the pattern from sandbox.
- [ ] T038: Smoke test — select shape in canvas, sidebar shows its properties. Edit properties, canvas updates. Same for bins. Delete works.

## Phase 6: Teardown

- [ ] T039: Delete `src/renderer/src/components/layout/` — LayoutCanvas, GridOverlay, EntityRenderer, EntityInteractionManager, TransformGizmo, SelectionBox, BinFootprint, KeepOutOverlay, BinInteractionManager.
- [ ] T040: Delete `src/renderer/src/components/primitives/` — CircleTool, RectangleTool, PolygonTool (replaced by DrawingToolLayer).
- [ ] T041: Delete entity system types — remove `Entity` discriminated union, `BaseEntity`, `CircleEntity`, `RectangleEntity`, `PolygonEntity`, `SvgRegionEntity`, `MeshEntity`, `LegacyEntity` from `project.ts`. Remove `Group`, `Generator` types if unused.
- [ ] T042: Delete old hooks — `useSharedSelection`, `useSelection`, `useSnapping`. Engine handles selection and grid snap natively.
- [ ] T043: Delete old utilities — `entity-shapes.ts`, `entity-geometry.ts`, `extrude.ts`, `z-layers.ts`, `snap.ts`. Keep `collision.ts` if bin collision logic still references it.
- [ ] T044: Delete old tests — remove tests for deleted entity system, hooks, and utilities. Keep CSG, threemf-writer, and project-handler tests.
- [ ] T045: Clean up imports — remove all dead imports across the codebase. Run typecheck + lint to catch stragglers.
- [ ] T046: Update project validator — `project-validator.ts` currently validates entities/bins. Update to validate `layoutSnapshot` structure instead.
- [ ] T047: Update CLAUDE.md — new architecture description, removed components, updated data flow.
- [ ] T048: Final verification — run full test suite, typecheck, lint. Interactive smoke test: new project → draw shapes → create bins → bake → 3D preview → export → save → reload → engine switch → undo/redo.

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | T001–T011 | Engine as source of truth, schema v0.5.0 |
| 2 | T012–T020 | Bin groups with Gridfinity metadata |
| 3 | T021–T026 | Drawing tools (DOM-based) |
| 4 | T027–T032 | CSG pipeline adapter |
| 5 | T033–T038 | Sidebar rebuild |
| 6 | T039–T048 | Delete dead code, cleanup |
| **Total** | **48 tasks** | |
