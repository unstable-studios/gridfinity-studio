# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gridfinity Studio is a cross-platform Electron desktop application for designing and managing Gridfinity modular storage systems. It provides interactive 3D visualization and editing of storage bin configurations using React, Three.js (via react-three-fiber), and TypeScript.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server with hot reload
pnpm build            # Typecheck + electron-vite build
pnpm typecheck        # Run type checking (separate node + web passes)
pnpm lint             # ESLint with cache
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
src/shared/         → Shared across all processes: types, schemas, validation
```

IPC communication flows through `window.api.project.*` methods (save, load, validate). All IPC handlers return `OperationResult<T>` for consistent error handling.

### Key Data Flow

The canonical project schema (`src/shared/types/project.ts`) is the single source of truth for project data. Projects are saved as `.gfstudio` files (JSON). The validator (`src/shared/validation/project-validator.ts`) enforces schema correctness including duplicate ID detection.

### Renderer Architecture

- **App.tsx** - Root layout: Navbar (top) + Sidebar (left) + Viewport (main)
- **Viewport.tsx** - Three.js canvas using `@react-three/fiber` and `@react-three/drei`
- **useProject()** hook - Project state management wrapping IPC calls
- **UI components** - Shadcn/ui (Radix + Tailwind) in `src/renderer/src/components/ui/`

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

- **Runtime**: Electron 39, Node v24, pnpm
- **Frontend**: React 19, Tailwind CSS 4, Shadcn/ui, Headless UI
- **3D**: Three.js via @react-three/fiber and @react-three/drei
- **Build**: electron-vite, Vite 7, TypeScript 5.9
- **Release**: release-please for automated versioning and CHANGELOG

## Active Technologies
- TypeScript 5.9 (strict mode, no `any`) + Electron 39, React 19, @react-three/fiber, @react-three/drei, Three.js, Tailwind CSS 4, Shadcn/ui, manifold (WASM, new), earcut (already a Three.js dep) (001-full-roadmap)
- `.gfstudio` files (JSON, project schema v0.2.0+) (001-full-roadmap)
- TypeScript 5.9 (strict mode, no `any`) + React 19, Three.js via @react-three/fiber, @react-three/drei, Electron 39 (007-interaction-layer-refactor)
- `.gfstudio` JSON files, schema version 0.3.0 → 0.4.0 (007-interaction-layer-refactor)
- TypeScript 5.9 (strict mode, no `any`) + Fabric.js v7 (imperative canvas), Konva 10 + react-konva 19 (declarative React canvas), React 19, Tailwind CSS 4, Shadcn/ui (009-layout-engine-abstraction)
- `.gfstudio` JSON files — project schema extended with engine-agnostic layout shapes (009-layout-engine-abstraction)

## Development Principles

### Integration-First Development

**Every feature must be exercised end-to-end before it is considered done.** Building a component in isolation and marking it complete is not acceptable — it must be mounted in the component tree, connected to state, and verified to actually work when a user interacts with it.

Concretely:
- **Test user flows, not units in isolation.** If a pan/zoom handler updates state but the camera never reads that state, the feature is broken — and any test that only checks "state updated" misses the point entirely.
- **The deliverable is a working user flow, not a component.** A tool that creates entities is not done until: tool click → entity appears in the list → entity renders on canvas → entity is selectable → properties are editable in the sidebar.
- **Smoke-test interactively.** After implementing a UI feature, describe what a user would see and do. If you can't trace the interaction from click to visible result, something is disconnected.
- **Never mark a task done without verifying integration.** A component that compiles but isn't wired into the app is dead code, not a feature.

## Recent Changes
- 009-layout-engine-abstraction: Added TypeScript 5.9 (strict mode, no `any`) + Fabric.js v7 (imperative canvas), Konva 10 + react-konva 19 (declarative React canvas), React 19, Tailwind CSS 4, Shadcn/ui
- 007-interaction-layer-refactor: Added TypeScript 5.9 (strict mode, no `any`) + React 19, Three.js via @react-three/fiber, @react-three/drei, Electron 39
- 001-full-roadmap: Added TypeScript 5.9 (strict mode, no `any`) + Electron 39, React 19, @react-three/fiber, @react-three/drei, Three.js, Tailwind CSS 4, Shadcn/ui, manifold (WASM, new), earcut (already a Three.js dep)
