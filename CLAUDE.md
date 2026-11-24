# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gridfinity Studio is a cross-platform Electron desktop application for designing Gridfinity modular storage systems. Users lay out bins on a 2D canvas (Konva), draw pocket shapes inside them, and preview the result as 3D meshes via a CSG pipeline. Built with React, TypeScript, and Electron.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server with hot reload
pnpm build            # Typecheck + electron-vite build
pnpm typecheck        # Run type checking (separate node + web passes)
pnpm lint             # ESLint with cache
pnpm test             # Vitest unit and contract tests
pnpm test:e2e         # Build, then drive the real app with Playwright (e2e/)
pnpm verify           # typecheck + lint + test + test:e2e — run before calling work done
pnpm format           # Prettier formatting
pnpm build:mac        # macOS build
pnpm build:linux      # Linux build
pnpm build:win        # Windows build
```

## Architecture

### Electron Multi-Process Model

The app follows Electron's strict process separation:

```
src/main/           → Main process (Node.js): window management, IPC handlers, file I/O
src/preload/        → Preload scripts: context bridge exposing window.api to renderer
src/renderer/       → React SPA: UI components, Three.js viewport, hooks
src/shared/         → Shared across all processes: types, validation
```

IPC communication flows through `window.api.project.*` methods (save, load, validate). All IPC handlers return `OperationResult<T>` (`src/shared/types/results.ts`). A failure carries the underlying `error` detail and, where it applies, a `reason`: `cancelled` (dialog dismissed, not an error) or `invalid` (not a valid project file). The project store turns failures into notices (`lib/project-notices.ts`), so every save, open and export shows its outcome.

Closing a window or quitting with unsaved work asks first (`src/main/close-guard.ts`). The renderer tells the main process whether there is unsaved work (`useCloseGuard`) and saves on request, since only it holds the project. Anything that closes the windows without giving them a say, such as installing an update, calls `settleUnsavedWork()` first and goes ahead only if it resolves to true.

### Key Data Flow

```
LayoutEngine (source of truth for 2D)
  ├─ LayoutShape[]  — pocket geometry (rect, circle, polygon, svgPath, meshImport)
  ├─ LayoutGroup[]  — bins with Gridfinity metadata (widthUnits, depthUnits, etc.)
  ├─ Selection, viewport, grid, undo/redo (snapshot-based)
  └─ Persisted as engine-agnostic LayoutSnapshot in .gfstudio files (schema v0.5.0)

Zustand (useProject)
  ├─ GlobalSettings, GridfinityConfig
  ├─ File operations (save/load via IPC)
  └─ Bake cache

CSG Pipeline (3D preview)
  ├─ LayoutShape[] → PocketSpec[] (converter)
  ├─ LayoutGroup metadata → CSGBinParams
  ├─ geometry.worker.ts → bin-csg-builder.ts → mesh arrays
  └─ ReviewCanvas renders meshes via R3F
```

The project schema (`src/shared/types/project.ts`, v0.5.0) stores a `layoutSnapshot` field containing all shapes, groups, and grid config. The validator (`src/shared/validation/project-validator.ts`) checks `settings`, `gridfinity` and the layout: ids are unique, positions and sizes are numbers, and each shape has its type's fields. Bins and shapes are put back in step on open (`repairLayout`), not refused. `docs/PROJECT_SCHEMA.md` describes the file format.

### Renderer Architecture

- **App.tsx** — Root layout: Navbar (top) + Sidebar (left) + Viewport (main)
- **Viewport.tsx** — 2D canvas powered by the LayoutEngine (Konva)
- **LayoutEngineContext** — Provides the engine instance to the component tree
- **useEngineState()** — Reactive engine state via `useSyncExternalStore` with tick-based mutation tracking
- **useProject()** — Project metadata and file operations (Zustand)
- **UI components** — Shadcn/ui (Radix + Tailwind) in `src/renderer/src/components/ui/`

### Layout Engine (`src/renderer/src/layout-engine/`)

The `LayoutEngine` interface abstracts all 2D canvas operations. Konva is the only adapter; Fabric.js was removed after both passed the same contract and end-to-end tests.

| File | Purpose |
|------|---------|
| `interface.ts` | Abstract LayoutEngine interface |
| `types.ts` | LayoutShape, LayoutGroup, LayoutSnapshot, events |
| `konva-engine.ts` | Konva 10 adapter (imperative) |
| `konva-group-renderer.ts` | Konva bin rendering (centroid positioning, decorations) |
| `collision.ts` | AABB collision detection for drag/resize |
| `arrange.ts` | Align and distribute math on world-space bounding boxes |
| `arrange-target.ts` | What the current selection can be aligned to |
| `position-frame.ts` | Converts between stored positions and the ones shown in the UI (lower-left origin, Y up) |
| `bin-artwork.ts` | Generates bin decorations (grid lines, screw holes, magnet holes) |
| `useLayoutEngine.ts` | React hook — reactive engine state via useSyncExternalStore |
| `useProjectEngineSync.ts` | Syncs engine ↔ project store on save/load |
| `useEngineUndoRedo.ts` | Snapshot-based undo/redo |
| `LayoutEngineContext.tsx` | React context provider |

**Coordinate convention**: `LayoutGroup.x/y` is the **lower-left corner** (smallest x, largest y in screen coords). Engines use center-based coords internally and convert at the boundary.

**Positions shown to the person** always have the origin at the lower left, X increasing right and Y increasing up: the canvas origin, or a bin's lower-left corner. Stored positions have Y increasing down, and a shape in a bin is stored relative to the bin's center. `position-frame.ts` is the only place that converts; use it for any position that appears in the UI.

### Path Aliases

- `@/` and `@renderer/` both resolve to `src/renderer/src/`

## Commit Conventions

Conventional commits are **strictly enforced** by commitlint in CI and Husky pre-commit hooks.

```
<type>(<scope>): <subject>
```

- **Types**: feat, fix, docs, style, refactor, perf, test, build, chore, ci
- **Scopes**: core, ui, middleware, ci, test, docs, repo, infra, deps, release (scope is optional)
- Subject: imperative mood, lowercase, no period, max 72 chars

## Code Style

- Prettier: single quotes, no semicolons, 100 char width, no trailing commas
- ESLint: `@electron-toolkit` TypeScript strict config with react-three plugins
- No `any` types in TypeScript

## Tech Stack

- **Runtime**: Electron 42, Node v24 (pinned by `devEngines.runtime`; pnpm downloads it and runs scripts with it), pnpm
- **Frontend**: React 19, Tailwind CSS 4, Shadcn/ui, Headless UI
- **2D Canvas**: Konva 10 (imperative), behind the LayoutEngine interface
- **3D Preview**: Three.js via @react-three/fiber and @react-three/drei
- **CSG**: Manifold (WASM) for solid geometry, earcut for triangulation
- **Build**: electron-vite, Vite 7, TypeScript 5.9
- **Release**: release-please for automated versioning and CHANGELOG
- **Project files**: `.gfstudio` (JSON, schema v0.5.0)

## Verifying Changes

`pnpm verify` is the definition of done. It ends with the end-to-end smoke suite in `e2e/`, which launches the built Electron app with Playwright and drives the core flow: new project → add bin → draw a pocket → save → undo/redo → 3D preview → export 3MF and STL → reopen.

- `e2e/app.ts` holds the helpers: launching with an isolated user-data directory, stubbing native file dialogs, tools, menus, and saving.
- Tests find things on the canvas without test hooks: draw a shape, save, and derive the world→screen mapping from the saved geometry (`mappingFromDrawnRect`).
- A failed run leaves a trace and screenshots in `e2e/.results/`; a passing run leaves `preview.png` of the 3D view. Look at it after visual changes.
- When a change adds or alters a user flow, extend the smoke suite in the same change.

## Development Principles

### Adapter-Based Modularity

Major subsystems must be decoupled from their implementation libraries through adapter interfaces. Application code consumes abstract interfaces; concrete library bindings live behind adapters that can be swapped, tested, or replaced independently.

- Define a TypeScript interface that captures the **capability**, not the library's API surface.
- Application components depend on the interface, never on library imports directly.
- Adapters convert between the interface's data model and the library's internals at the boundary (e.g., lower-left corner ↔ centroid coordinate conversion in the layout engine).
- Persisted data must be engine-agnostic — no library-specific artifacts in snapshots or project files.

**Established pattern**: The `LayoutEngine` interface with its Konva adapter (009/010); `create-engine.ts` is the only file that names the adapter. Future candidates include the CSG/geometry pipeline, 3D preview renderer, file format exporters, and input handling layer.

### Integration-First Development

**Every feature must be exercised end-to-end before it is considered done.** Building a component in isolation and marking it complete is not acceptable — it must be mounted in the component tree, connected to state, and verified to actually work when a user interacts with it.

Concretely:
- **Test user flows, not units in isolation.** If a pan/zoom handler updates state but the camera never reads that state, the feature is broken — and any test that only checks "state updated" misses the point entirely.
- **The deliverable is a working user flow, not a component.** A tool that creates entities is not done until: tool click → entity appears in the list → entity renders on canvas → entity is selectable → properties are editable in the sidebar.
- **Smoke-test interactively.** After implementing a UI feature, describe what a user would see and do. If you can't trace the interaction from click to visible result, something is disconnected.
- **Never mark a task done without verifying integration.** A component that compiles but isn't wired into the app is dead code, not a feature.

## Recent Changes
- 013-shape-drag-assignment: Shape-to-bin assignment via drag. Centroid-based group membership evaluation on drag end. Real-time bin highlighting during shape drag. Extracted `findContainingBinGroup` into shared `containment.ts`. New `shapeReassigned` event.
- 012-input-decoupling: GestureRecognizer + InputActionHandler interface. Engine-agnostic input processing for pan, zoom, rubber-band, click-select.
- 010-layout-engine-integration: LayoutEngine is now source of truth for all 2D state. Project schema v0.5.0 with `layoutSnapshot`. Old entity/bin system fully removed. Drag-to-resize with collision detection, bin artwork decorations, snapshot-based undo/redo.

## Spec Kit

Spec Kit 1.4 commands are skills: `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, ... (`/speckit-git-*` and `/speckit-github-taskstoissues` from the git and github extensions). `/speckit-specify` creates the feature branch and records the feature in `.specify/feature.json` (not committed). To resume a feature in a fresh clone or worktree, set it once: `SPECIFY_FEATURE_DIRECTORY=specs/<NNN-name>` before the first `/speckit-*` command. Upgrade with `specify integration upgrade claude`.
