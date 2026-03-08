# Spec: Layout Engine Integration (Clean Slate)

**Date**: 2026-03-08
**Feature**: 010-layout-engine-integration
**Depends on**: 009-layout-engine-abstraction (complete)

## Problem

The layout engine abstraction (Fabric.js + Konva adapters) works in the sandbox but isn't connected to the real app. The production 2D layout view still runs on R3F with a complex Entity system, interaction managers, and custom gizmos. Rather than bridging the two worlds, we're nuking the old layout mode and rebuilding on top of the engine.

## Goal

The LayoutEngine becomes the **source of truth** for all 2D layout state. No bridge, no translation layer, no dual data models. The old Entity system, R3F layout components, and all supporting infrastructure are removed.

After this work:
- `LayoutShape` replaces `Entity` for pocket geometry in the layout view
- `LayoutGroup` replaces `Bin` as the container concept (with Gridfinity metadata)
- Undo/redo is engine-snapshot-based (already built in sandbox)
- The CSG bin builder pipeline is preserved and fed from LayoutShapes instead of Entities
- The 3D review mode (ReviewCanvas/BinPreview) is preserved
- Project schema bumps to v0.5.0 with `layoutSnapshot` as the canonical layout data

## What We're Keeping

### Absolutely preserved (no changes)
- `bin-csg-builder.ts` — CSG solid modeling pipeline (Manifold)
- `bin-generator.ts` — Gridfinity spec constants and profile data
- `geometry.worker.ts` — Web Worker for off-thread CSG builds
- `useGeometryWorker.ts` — React hook for worker communication
- `threemf-writer.ts` — 3MF export
- `stl-io.ts` — STL export
- `keep-out.ts` — Keep-out zone geometry computation
- `ReviewCanvas.tsx` / `BinPreview.tsx` — 3D preview (stays R3F)
- All shared types in `src/shared/` (GridfinityConfig, PocketConfig, etc.)
- Preload/main process code (IPC, file I/O, export handlers)

### Preserved with minor adaptation
- `useGeometryWorker` / Sidebar bake flow — currently reads `Entity[]` to build `PocketSpec[]`. Will read `LayoutShape[]` from engine instead. The conversion (`entityToVertices`) becomes `layoutShapeToVertices`.
- `Sidebar.tsx` — currently reads entities/bins from Zustand. Will read shapes/groups from engine + gridfinity metadata. Significant rewrite but same UX.
- `useProject.ts` — stripped of entity/bin mutations. Keeps file operations, gridfinity config, project metadata. Undo/redo moves to engine.
- Project schema — `entities[]` and `bins[]` removed, `layoutSnapshot` becomes required and fully typed.

## What We're Removing

### R3F layout components (entire directory)
- `LayoutCanvas.tsx` — R3F canvas orchestrator
- `GridOverlay.tsx` — R3F grid lines
- `EntityRenderer.tsx` — Three.js entity visuals
- `EntityInteractionManager.tsx` — R3F hit meshes
- `TransformGizmo.tsx` — R3F drag/resize handles
- `SelectionBox.tsx` — R3F marquee rectangle
- `BinFootprint.tsx` — R3F bin outline
- `KeepOutOverlay.tsx` — R3F constraint overlay
- `BinInteractionManager.tsx` — R3F bin interaction
- `CircleTool.tsx` / `RectangleTool.tsx` / `PolygonTool.tsx` — R3F drawing tools

### Entity system infrastructure
- Entity discriminated union types (`CircleEntity`, `RectangleEntity`, etc.)
- `useSharedSelection` / `useSelection` hooks (engine handles selection)
- `useSnapping` hook (engine grid snap; entity-to-entity snap deferred)
- `entity-shapes.ts` / `entity-geometry.ts` — entity→vertex conversion (replaced)
- `extrude.ts` — entity extrusion (CSG builder handles this)
- `z-layers.ts` — R3F z-ordering constants
- Entity mutations in `useProject.ts` (addEntity, updateEntity, moveEntity, etc.)
- Bin mutations in `useProject.ts` (addBin, updateBin, moveBin, etc.)

## Architecture

### New Data Flow

```
LayoutEngine (source of truth for 2D)
  ├─ LayoutShape[] — pocket geometry (rect, circle, polygon, svgPath, meshImport)
  ├─ LayoutGroup[] — bins (with gridfinity metadata)
  ├─ Selection — engine-native
  ├─ Undo/redo — snapshot-based (already working)
  └─ Grid, viewport, theme — engine-native

Zustand (project metadata only)
  ├─ GlobalSettings (name, author, units)
  ├─ GridfinityConfig (baseUnit, tolerance, holes)
  ├─ File operations (save, load, export)
  └─ Bake results cache

CSG Pipeline (preserved, input changes)
  ├─ LayoutShape[] → PocketSpec[] (new converter)
  ├─ LayoutGroup metadata → CSGBinParams
  ├─ geometry.worker.ts → bin-csg-builder.ts → mesh arrays
  └─ ReviewCanvas renders mesh arrays via R3F (unchanged)
```

### LayoutGroup as Bin

Bins become `LayoutGroup` objects with Gridfinity metadata:

```typescript
// LayoutGroup.metadata carries bin-specific config
interface BinMetadata {
  widthUnits: number
  depthUnits: number
  heightUnits: number
  hasLip: boolean
  // magnetHoles and screwHoles come from global GridfinityConfig
}

// Example: a 2x3 bin at grid position (0, 0)
engine.createGroup({
  id: 'bin-1',
  x: 42,    // 1 grid unit from origin (centroid)
  y: 63,    // 1.5 grid units
  width: 84,  // 2 * baseUnit
  height: 126, // 3 * baseUnit
  rotation: 0,
  childIds: ['pocket-1', 'pocket-2'],
  style: { fill: 'rgba(96, 165, 250, 0.05)', stroke: '#60a5fa', strokeWidth: 1 },
  metadata: { widthUnits: 2, depthUnits: 3, heightUnits: 4, hasLip: true }
})
```

### Project Schema v0.5.0

```typescript
interface ProjectData {
  schemaVersion: '0.5.0'
  settings: GlobalSettings
  gridfinity: GridfinityConfig
  layoutSnapshot: LayoutSnapshot  // required, fully typed
  // entities[], bins[], groups[], generators[] — REMOVED
}
```

Migration from v0.4.0: load old entities/bins, convert to LayoutShapes/LayoutGroups, write as layoutSnapshot. One-way migration — old format is not round-trippable.

### CSG Pipeline Adapter

The CSG builder needs `PocketSpec[]` (vertices + depth + position). Currently built from `Entity[]` via `entityToVertices()`. New path:

```typescript
function layoutShapeToPocketSpec(shape: LayoutShape, group: LayoutGroup): PocketSpec | null {
  // Convert shape geometry to Float32Array vertices
  // Position relative to bin center
  // Read pocket depth/clearance from shape.metadata
}
```

This is a thin adapter. The CSG builder itself (`bin-csg-builder.ts`) and worker are untouched.

## Phases

### Phase 1: Engine as Source of Truth
- Mount `LayoutEngineProvider` in layout mode (replace LayoutCanvas)
- Strip entity/bin mutations from Zustand store
- Wire `engine.toSnapshot()` into project save (layoutSnapshot is the data)
- Wire `engine.loadSnapshot()` from project load
- Implement v0.4.0 → v0.5.0 migration (entities/bins → shapes/groups)
- Grid config from GridfinityConfig, theme from app theme

### Phase 2: Bin Groups
- Implement bin creation as `LayoutGroup` with Gridfinity metadata
- Extend engine interface if needed for group rendering (rounded rect, lip line)
- Bin-specific rendering: keep-out zones as non-interactive overlay shapes within the group
- Bin creation UI (grid picker, sidebar controls) wired to `engine.createGroup()`

### Phase 3: Drawing Tools
- Circle, rectangle, polygon drawing tools as DOM event handlers over engine canvas
- Tool preview via temporary engine shapes
- Pocket assignment: new shapes created inside a group inherit group membership
- Drawing tool state machine (especially polygon close-snap)

### Phase 4: CSG Pipeline Adapter
- `layoutShapeToPocketSpec()` converter
- Wire sidebar bake flow to read from engine instead of Zustand entities
- `CSGBinParams` built from `LayoutGroup.metadata` + `GridfinityConfig`
- Verify 3D preview renders correctly from engine-sourced data
- Run existing CSG tests to confirm no regression

### Phase 5: Teardown
- Delete all R3F layout components (`src/renderer/src/components/layout/`)
- Delete R3F drawing tools (`src/renderer/src/components/primitives/`)
- Delete entity system types and infrastructure
- Delete old hooks (`useSharedSelection`, `useSnapping`, `useSelection`)
- Delete old utilities (`entity-shapes.ts`, `entity-geometry.ts`, `extrude.ts`, `z-layers.ts`)
- Strip entity/bin arrays from project schema types
- Remove dead tests, update remaining tests
- Clean up imports, run typecheck + lint
- Update CLAUDE.md

### Phase 6: Sidebar Rebuild
- Sidebar reads shapes/groups from engine (not Zustand entities)
- Property editing calls `engine.updateShape()` / `engine.updateGroup()`
- Bin properties panel edits group metadata
- Bake trigger reads from engine
- Export flow reads bake results (unchanged)

## Post-Integration Follow-up

### Immediate
1. **Engine group rendering** — if LayoutGroup doesn't render correctly as a visual bin container (rounded rect, lip line), extend the engine adapters to support custom group rendering or use nested non-interactive shapes.
2. **Entity-to-entity snapping** — deferred. Engine only snaps to grid. Can add `setSnapTargets()` to the engine interface later.
3. **Input decoupling (#226)** — the per-engine input hacks still exist. Clean up once integration is stable.

### Near-term
4. **Collision detection** — bin overlap rejection during drag. May need an engine interface extension or a bridge-layer concern.
5. **Typed LayoutSnapshotData (#230)** — now critical since layoutSnapshot is the canonical data.
6. **Snapshot validation (#231)** — runtime validation before loading.

### Longer-term
7. **Remove R3F entirely** — if 3D preview moves to raw Three.js, the R3F dependency can be dropped.
8. **Pattern system** — generators/patterns become engine-level operations on shapes.

### Design Principle: Adapter-Based Modularity

The layout engine integration (009 + 010) established adapter-based modularity as a core project principle (Constitution VII). The `LayoutEngine` interface with Fabric.js and Konva adapters proved that major subsystems can be decoupled from their implementation libraries through abstract interfaces, enabling runtime swapping, independent testing, and localized migration when libraries change.

This pattern should be extended to future subsystems: CSG/geometry pipeline, 3D preview renderer, file format exporters, and input handling. See the constitution for the full principle statement.

## Acceptance Criteria

- [ ] Layout mode renders all shape types via LayoutEngine (no R3F)
- [ ] Shapes are selectable, draggable (with grid snap), resizable, deletable
- [ ] Bins render as LayoutGroups with correct Gridfinity dimensions
- [ ] Drawing tools create shapes (circle, rect, polygon)
- [ ] Undo/redo works (engine snapshot-based)
- [ ] Project save/load round-trips through layoutSnapshot
- [ ] v0.4.0 projects migrate to v0.5.0 on load
- [ ] CSG bin builder produces correct meshes from engine shapes
- [ ] 3D review mode works (ReviewCanvas/BinPreview unchanged)
- [ ] All R3F layout components removed
- [ ] Engine switching works in layout mode
- [ ] Theme switching works
- [ ] Sidebar shows/edits shape and bin properties from engine state
- [ ] Export (STL/3MF) works end-to-end
