# Implementation Plan: Full Roadmap

**Branch**: `001-full-roadmap` | **Date**: 2026-03-04 | **Spec**: [spec.md](./spec.md)
**Input**: All 36 open GitHub issues (#83–#120) organized into an 8-phase implementation plan

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement the complete Gridfinity Studio feature set across 8 dependency-ordered phases, transforming the current shell (project schema + validation + IPC + demo viewport) into a functional 3D bin design tool. The roadmap covers: project file management, undo/redo, 2D layout with primitives and SVG import, pattern generation, mesh booleans via manifold WASM, Gridfinity bin generation, STL/3MF export, and analysis tooling.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, no `any`)
**Primary Dependencies**: Electron 39, React 19, @react-three/fiber, @react-three/drei, Three.js, Tailwind CSS 4, Shadcn/ui, manifold (WASM, new), earcut (already a Three.js dep)
**Storage**: `.gfstudio` files (JSON, project schema v0.2.0+)
**Testing**: Vitest (to be added — no test runner currently configured beyond the manual validation script)
**Target Platform**: macOS, Linux, Windows (Electron desktop)
**Project Type**: Desktop application (Electron)
**Performance Goals**: 60fps viewport interaction, <2s bake for typical bins, <500ms export
**Constraints**: Offline-capable (no network required), <200MB installed size
**Scale/Scope**: Single-user desktop app, projects with up to ~500 entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety & Schema Correctness | PASS | All new types extend existing strict schema. Schema bump 0.1.0 → 0.2.0 with backward compat. |
| II. Electron Process Isolation | PASS | New IPC channels follow existing `window.api.*` pattern. Geometry worker runs in renderer (Web Worker, not Node). |
| III. Test-First Development | PASS | Each phase starts with test scaffolding. Vitest setup is Phase 1 prerequisite. |
| IV. 3D Performance | PASS | Geometry operations offloaded to worker (#105). Instanced rendering for patterns. 60fps target explicit. |
| V. User Experience & Accessibility | PASS | Undo/redo (#84) covers all mutations. Keyboard shortcuts planned. Grid snapping aids precision. |
| VI. Conventional Commits & CI | PASS | Each issue = 1+ conventional commits. CI gates enforced. |
| VII. Simplicity & YAGNI | PASS | Phased approach avoids speculative features. Each phase delivers independently testable functionality. |

**Post-Phase 1 Re-check**: The manifold WASM dependency (Phase 5) is the largest new addition. Justified in research.md — no simpler alternative produces manifold-correct output required for 3D printing.

## Project Structure

### Documentation (this feature)

```text
specs/001-full-roadmap/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity extensions and relationships
├── quickstart.md        # Phase 1: getting started guide
├── contracts/
│   └── ipc-channels.md  # Phase 1: IPC and worker message contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── index.ts                    # Electron entry + IPC registration
│   ├── project-handler.ts          # Existing: save/load/validate
│   ├── import-handler.ts           # NEW: SVG + STL file import IPC
│   └── export-handler.ts           # NEW: STL + 3MF + batch export IPC
├── preload/
│   ├── index.ts                    # Context bridge (extend with new channels)
│   └── index.d.ts                  # Type declarations
├── renderer/
│   └── src/
│       ├── App.tsx                  # Root layout (modes: layout | review)
│       ├── components/
│       │   ├── Navbar.tsx           # Extend with mode switching, undo/redo buttons
│       │   ├── Sidebar.tsx          # Extend with entity list, properties panel
│       │   ├── Viewport.tsx         # Extend with mode-dependent camera/controls
│       │   ├── Logo.tsx
│       │   ├── layout/             # NEW: 2D layout mode components
│       │   │   ├── LayoutCanvas.tsx     # Orthographic camera + grid overlay
│       │   │   ├── GridOverlay.tsx      # Gridfinity grid lines (#87)
│       │   │   ├── EntityRenderer.tsx   # 2D shape rendering
│       │   │   ├── SelectionBox.tsx     # Marquee + multi-select (#92)
│       │   │   └── TransformGizmo.tsx   # Move/rotate handles (#92)
│       │   ├── review/             # NEW: 3D review mode components
│       │   │   ├── ReviewCanvas.tsx     # Perspective camera + orbit
│       │   │   └── BinPreview.tsx       # Baked mesh visualization (#111)
│       │   ├── primitives/         # NEW: 2D primitive creation
│       │   │   ├── CircleTool.tsx       # (#88)
│       │   │   ├── RectangleTool.tsx    # (#89)
│       │   │   └── PolygonTool.tsx      # (#90)
│       │   ├── patterns/           # NEW: Pattern generation UI
│       │   │   └── PatternPanel.tsx     # (#97-#101)
│       │   ├── export/             # NEW: Export UI
│       │   │   └── ExportPanel.tsx      # (#112, #113, #119)
│       │   └── ui/                 # Existing Shadcn components
│       ├── hooks/
│       │   ├── useProject.tsx       # Existing: extend with new/recent
│       │   ├── useUndo.ts           # NEW: undo/redo state management (#84)
│       │   ├── useSelection.ts      # NEW: entity selection state (#92)
│       │   ├── useSnapping.ts       # NEW: grid + entity snapping (#93)
│       │   └── useGeometryWorker.ts # NEW: worker communication (#105)
│       ├── workers/
│       │   └── geometry.worker.ts   # NEW: booleans, extrusion, bake (#105, #106, #107)
│       ├── lib/
│       │   ├── undo.ts              # NEW: command pattern implementation (#84)
│       │   ├── snap.ts              # NEW: snap target resolution (#93)
│       │   ├── extrude.ts           # NEW: 2D → 3D extrusion (#102, #103)
│       │   ├── bin-generator.ts     # NEW: parametric bin mesh (#109)
│       │   ├── svg-import.ts        # NEW: SVG path parsing (#91)
│       │   ├── stl-io.ts            # NEW: STL import/export helpers (#104, #112)
│       │   ├── threemf-writer.ts    # NEW: 3MF package writer (#119)
│       │   └── analysis.ts          # NEW: wall/floor thickness (#116)
│       └── assets/
└── shared/
    ├── types/
    │   └── project.ts               # Extend with new entity types, extrusion, pattern configs
    └── validation/
        └── project-validator.ts     # Extend with new entity validation rules
```

**Structure Decision**: Follows the existing Electron multi-process layout. New code is organized by domain within the renderer (layout/, review/, primitives/, patterns/, export/). Shared geometry logic lives in `lib/` and the heavy computation in `workers/`.

## Integration Architecture

> **Lesson learned**: The original plan treated each issue as an isolated component. Components were built correctly in isolation but never connected. This section defines the data flow contracts that glue components together.

### Data Flow: Tool → Canvas → State → Renderer

```text
User clicks canvas with tool active
       ↓
LayoutScene mounts active tool component (CircleTool, RectangleTool, PolygonTool)
  based on activeTool from useAppMode()
       ↓
Tool captures Three.js pointer events on its invisible hit plane
  (tools use ThreeEvent, NOT DOM PointerEvent — they must live inside <Canvas>)
       ↓
Tool calls onPlace(partialEntity) when placement completes
       ↓
onPlace handler generates ID + defaults, calls useProject().addEntity(entity)
       ↓
project.entities updates → EntityRenderer re-renders all entities
       ↓
useSelection() tracks selected entity IDs (shared across Viewport + Sidebar)
       ↓
TransformGizmo reads selectedIds + entities, calls useProject().updateEntity(id, patch) on drag
  useSnapping() resolves snap targets during drag
       ↓
Sidebar reads selectedIds → shows properties for selected entity
  Property edits call useProject().updateEntity(id, patch)
```

### Required Wiring Points

These are the integration seams that must exist for any interactive editing to work. Each represents a connection between two independently-built components.

| Seam | Owner File | What It Connects | Contract |
|------|-----------|------------------|----------|
| **Entity mutations** | `useProject.tsx` | Tools/Sidebar → project state | `addEntity(e)`, `updateEntity(id, patch)`, `removeEntity(id)` |
| **Tool mounting** | `LayoutCanvas.tsx` (LayoutScene) | activeTool → tool component | Conditional render based on `useAppMode().activeTool` |
| **Entity ID + defaults** | `Viewport.tsx` or a factory util | Tool's `Partial<Entity>` → complete `Entity` | Generate UUID, set `name`, `visible: true`, `locked: false`, `properties: {}` |
| **Selection sharing** | `Viewport.tsx` | Selection hook → LayoutCanvas + Sidebar | Single `useSelection()` instance, passed as props |
| **Snapping in transforms** | `TransformGizmo.tsx` | Drag handler → snap resolution | `useSnapping().snap(cursor, gridSize, entities)` |
| **Sidebar ↔ selection** | `Sidebar.tsx` | Shared selection → property panel | Read `selectedIds` from shared hook, not local state |
| **Sidebar ↔ mutations** | `Sidebar.tsx` | Property edits → project state | Call `updateEntity(id, patch)` on field change |

### Anti-Pattern to Avoid

**Do NOT** create a component, mark it done, and move on without verifying it is mounted in the component tree and connected to state. Each component task must include:
1. The component implementation
2. Mounting it in its parent
3. Connecting its callbacks to state mutations
4. Verifying the round-trip: action → state change → re-render

## Current State Audit (as of 2026-03-04)

> This section tracks what is actually implemented vs what needs work. Updated after the Phase 3 integration gap was discovered.

### Working (isolated, not connected)
- **Tool components**: CircleTool, RectangleTool, PolygonTool — complete, never mounted in LayoutScene
- **EntityRenderer** — renders entities correctly, but no entities ever reach project state
- **useSelection, useSnapping** — complete hooks, never instantiated
- **TransformGizmo, SelectionBox** — complete, never mounted in LayoutScene
- **Navbar tool selection** — sets activeTool correctly
- **GridOverlay** — renders correctly
- **extrude.ts** — real earcut-based extrusion
- **bin-generator.ts** — real mesh generation (holes additive, awaits CSG)
- **mesh-convert.ts, stl-io.ts** — functional utilities
- **useGeometryWorker** — working worker lifecycle

### Broken (integration missing)
- **useProject** — no `addEntity`/`updateEntity`/`removeEntity` methods
- **Viewport** — doesn't instantiate selection/snapping or pass pointer events
- **LayoutScene** — doesn't mount tools, TransformGizmo, or SelectionBox
- **Sidebar** — display-only, local selection state, no mutation callbacks
- **geometry.worker boolean/bake** — returns "not yet implemented" errors

### Phases 1–2: Complete
- Vitest, dependencies, project structure, schema extensions, unit system, IPC, undo stack

### Phase 3 (US1): Components built, integration incomplete
- All individual components exist and are internally correct
- The wiring layer (see Integration Architecture above) was never implemented

## Phased Implementation

### Phase 1: Foundation (#83, #84, #108)

**Goal**: Core infrastructure that all subsequent phases depend on.

| Issue | Title | Key Work |
|-------|-------|----------|
| #108 | Gridfinity unit system + presets | Extract GridfinityConfig defaults, add tolerance profiles, expose in settings UI |
| #83 | Load / Save project files | Wire File menu → new/open/save, recent files, asset reference persistence |
| #84 | Undo / Redo system | Command pattern in `lib/undo.ts`, `useUndo` hook, Cmd+Z / Cmd+Shift+Z |

**Prerequisites**: Set up Vitest test runner + test infrastructure.

### Phase 2: 2D Layout Core (#86, #87, #88, #89, #90, #92, #93)

**Goal**: Interactive 2D canvas where users can place and manipulate shapes.

**CRITICAL**: This phase is not complete until a user can select a tool, click on the canvas, and see the created shape persist in the entity list. Each component must be wired into the integration layer (see Integration Architecture).

| Issue | Title | Key Work |
|-------|-------|----------|
| — | **Entity mutation API** | Add `addEntity`, `updateEntity`, `removeEntity` to `useProject` — **prerequisite for all tools** |
| #86 | 2D Layout mode (orthographic) | OrthographicCamera, pan/zoom, mode toggle in navbar |
| #87 | Gridfinity grid overlay | Grid lines at baseUnit intervals, toggle, layout-mode only |
| #88 | 2D primitive — Circle | Circle tool component + **mount in LayoutScene** + **onPlace → addEntity** |
| #89 | 2D primitive — Rectangle | Rectangle tool component + **mount in LayoutScene** + **onPlace → addEntity** |
| #90 | 2D primitive — Polygon | Polygon tool component + **mount in LayoutScene** + **onPlace → addEntity** |
| #92 | Selection + transform (2D) | Click/marquee select, move/rotate gizmo + **mount in LayoutScene** + **shared useSelection in Viewport** |
| #93 | Grid snapping system | Snap to grid + entity anchors + **integrate into TransformGizmo drag** |
| — | **Sidebar wiring** | Connect sidebar entity list + properties to shared selection and `updateEntity` |

**Completion criteria**: User can draw a rectangle on the canvas, see it appear, select it, move it with snapping, edit properties in sidebar, and see changes persist when saving/loading the project.

### Phase 3: Layout Tools (#91, #94, #95, #96)

**Goal**: Advanced layout manipulation for precise positioning.

| Issue | Title | Key Work |
|-------|-------|----------|
| #91 | SVG import → 2D sketch | Parse SVG paths, convert to polygon regions, import dialog |
| #94 | Group entities | Group/ungroup, hierarchical transforms, group selection |
| #95 | Align tools (XY) | Left/right/top/bottom/center alignment for selection |
| #96 | Distribute tools (XY) | Equal spacing distribution, optional grid-unit snapping |

### Phase 4: Patterns (#97, #98, #99, #100, #101)

**Goal**: Procedural duplication for repetitive layouts (socket trays, tool holders).

| Issue | Title | Key Work |
|-------|-------|----------|
| #97 | Linear pattern generator | Generator node, X/Y axis, instance rendering |
| #98 | Pattern spacing — constant pitch | Fixed spacing between instances |
| #99 | Pattern spacing — size-aware pitch | Spacing derived from instance bounds + gap |
| #100 | Pattern spacing — explicit array | Per-instance position array |
| #101 | Break pattern instance | Detach single instance to manual entity |

### Phase 5: 3D Geometry Engine (#102, #103, #104, #105, #106, #107, #109)

**Goal**: Transform 2D layouts into 3D printable geometry.

**NOTE**: Worker infrastructure and extrude logic exist but boolean/bake message handlers are stubs returning "not yet implemented". Manifold WASM is not initialized. The Sidebar bake/generate buttons are no-ops. This phase must wire the full pipeline: entity → extrude → boolean → bake → preview.

| Issue | Title | Key Work |
|-------|-------|----------|
| #105 | Geometry worker thread | Web Worker setup, message protocol, **manifold WASM initialization** |
| #106 | Mesh boolean engine | Union/subtract/intersect via manifold, **implement boolean/bake worker handlers** |
| #102 | Extrude 2D region to solid | Earcut triangulation + Z extrusion, configurable depth |
| #103 | Extrude 2D region to cutter | Same as solid but role=cutter, subtracted during bake |
| #104 | STL import as mesh entity | STLLoader, mesh entity type, transform support |
| #109 | Gridfinity bin geometry generator | Parametric bin from GridfinityConfig, lip/magnet options, **wire Sidebar Generate button** |
| #107 | Bake geometry action | **Wire Sidebar Bake button** → boolean pipeline → bakeResult state, dirty tracking |

**Completion criteria**: User can extrude an entity, generate a bin, bake the combined mesh, and see the result in 3D review mode.

### Phase 6: Export & Review (#111, #112, #113, #119)

**Goal**: Visualize final output and export for 3D printing.

| Issue | Title | Key Work |
|-------|-------|----------|
| #111 | 3D Review mode basics | Perspective camera, baked mesh rendering, Z controls |
| #112 | STL export | STLExporter from baked mesh, file dialog |
| #113 | Batch export bins | Export all/selected bins with filename pattern |
| #119 | 3MF export | Minimal 3MF writer (ZIP + XML), metadata support |

### Phase 7: Analysis & Safety (#114, #115, #116)

**Goal**: Help users avoid printability issues before export.

| Issue | Title | Key Work |
|-------|-------|----------|
| #115 | Collision detection (2D footprint) | Overlap detection in layout mode, visual warnings |
| #114 | Gridfinity keep-out visualization | Magnet/screw/lip regions shown in layout + review |
| #116 | Wall/floor thickness analysis | Post-bake mesh analysis, thin region warnings |

### Phase 8: Polish & Advanced (#110, #117, #118, #120)

**Goal**: Quality-of-life features and validation.

| Issue | Title | Key Work |
|-------|-------|----------|
| #110 | Auto-wrap selection into bin | Compute minimal grid-aligned bin for selected parts |
| #117 | Deterministic output tests | Identical inputs → identical outputs (within tolerance) |
| #118 | Example projects | Sample `.gfstudio` files demonstrating key workflows |
| #120 | Multi-bin packing | Partition large layouts into multiple grid-aligned bins |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| manifold WASM dependency (~2MB) | Mesh booleans must produce manifold output for 3D printing | three-bvh-csg produces non-manifold results on complex cases; no simpler library handles coplanar faces correctly |
| Web Worker for geometry | Boolean ops take 100ms–2s, would freeze UI | requestIdleCallback doesn't help with >16ms operations; chunking booleans isn't feasible |
