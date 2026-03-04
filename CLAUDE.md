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

## Recent Changes
- 001-full-roadmap: Added TypeScript 5.9 (strict mode, no `any`) + Electron 39, React 19, @react-three/fiber, @react-three/drei, Three.js, Tailwind CSS 4, Shadcn/ui, manifold (WASM, new), earcut (already a Three.js dep)
