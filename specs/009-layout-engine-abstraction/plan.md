# Implementation Plan: Layout Engine Abstraction

**Branch**: `009-layout-engine-abstraction` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-layout-engine-abstraction/spec.md`

## Summary

Introduce a library-agnostic `LayoutEngine` interface that decouples Gridfinity Studio's 2D layout canvas from any specific rendering library. Two concrete adapter implementations (Fabric.js v7 and Konva/react-konva) satisfy the interface. A React hook + context provides the active engine to UI components. Runtime engine switching is supported via a preference toggle. All shape data uses engine-agnostic types for project persistence.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, no `any`)
**Primary Dependencies**: Fabric.js v7 (imperative canvas), Konva 10 (imperative canvas — raw API, not react-konva), React 19, Tailwind CSS 4, Shadcn/ui, mitt (typed event emitter, 200 bytes)
**Storage**: `.gfstudio` JSON files — project schema extended with engine-agnostic layout shapes
**Testing**: Vitest (unit/contract tests for interface compliance, adapter parity)
**Target Platform**: Electron 39 desktop (macOS, Linux, Windows)
**Project Type**: Desktop application (Electron + React renderer)
**Performance Goals**: 60 fps canvas interaction, <100ms sidebar sync, 200+ shapes without lag
**Constraints**: No library-specific types beyond adapter boundary, engine switch <2s, zero data loss on switch
**Scale/Scope**: Single project file, typically 1-50 bins with 1-20 shapes each, max ~500 shapes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety & Schema Correctness | PASS | LayoutShape/LayoutGroup are strict TypeScript discriminated unions. Schema extended with engine-agnostic types. No `any`. |
| II. Electron Process Isolation | PASS | Engine lives entirely in renderer process. No IPC changes needed — serialization uses existing `window.api.project.*` surface. |
| III. Test-First Development | PASS | Contract tests verify both adapters satisfy the interface. Parity tests ensure identical behavior. |
| IV. 3D Performance | PASS | This feature is 2D canvas only. R3F/Three.js preview is unchanged. 2D target: 60fps with 200+ shapes. |
| V. User Experience & Accessibility | PASS | No UX regression — canvas interactions identical. Engine switch is a preference toggle with clear labeling. |
| VI. Conventional Commits & CI Discipline | PASS | Standard workflow. Commits scoped to `core` (interface/types) and `ui` (adapters/integration). |
| VII. Simplicity & YAGNI | JUSTIFIED | The adapter pattern adds a layer of abstraction, but it is the minimal design that satisfies the requirement of swappable engines. See Complexity Tracking. |

## Project Structure

### Documentation (this feature)

```text
specs/009-layout-engine-abstraction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── layout-engine.md # Engine interface contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/src/
├── layout-engine/
│   ├── types.ts                # LayoutShape, LayoutGroup, LayoutSnapshot, EngineEvent types
│   ├── interface.ts            # LayoutEngine interface definition
│   ├── fabric-engine.ts        # Fabric.js v7 adapter
│   ├── konva-engine.ts         # Konva/react-konva adapter
│   ├── useLayoutEngine.ts      # React hook: engine lifecycle, context provider
│   └── LayoutEngineContext.tsx  # React context for engine provision
├── components/
│   ├── Viewport.tsx            # Modified: uses useLayoutEngine instead of LayoutCanvas
│   ├── Sidebar.tsx             # Modified: reads shape properties via engine interface
│   └── Navbar.tsx              # Modified: engine toggle in preferences
└── hooks/
    └── useAppMode.ts           # Extended: engine preference state
```

**Structure Decision**: New `layout-engine/` module under renderer `src/`. Contains the interface, types, both adapters, and the React integration hook. Existing components are modified to consume the engine through context rather than directly importing canvas components. Sandbox prototypes in `components/sandbox/` remain as reference during development.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Adapter pattern (Principle VII) | Requirement is dual-engine support with runtime switching. The interface + 2 adapters is the minimum design. | Direct conditional rendering (if fabric/if konva) would leak library types into Viewport/Sidebar and make the codepaths unmaintainable. A single engine with no abstraction would not satisfy the swappable-engine requirement. |

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety | PASS | LayoutShape is a discriminated union. EngineEventMap is a typed map. No `any` needed — both Fabric and Konva have TypeScript types. |
| II. Process Isolation | PASS | All engine code is renderer-only. Serialization produces plain JSON that flows through existing IPC. |
| III. Test-First | PASS | Contract tests defined in contracts/layout-engine.md (C1-C21). Both adapters must pass identical suite. |
| IV. 3D Performance | PASS | R3F/Three.js unchanged. 2D canvas targets 60fps. Both engines confirmed performant at 200-500 shapes. |
| V. UX & Accessibility | PASS | Transform handles, keyboard shortcuts, grid snapping all specified. Engine switch is a labeled preference toggle. |
| VI. Conventional Commits | PASS | Standard workflow. |
| VII. Simplicity | JUSTIFIED | Adapter pattern is minimum viable design for swappable engines. Research confirmed Two.js and PixiJS use the same pattern. Raw Konva (not react-konva) keeps both adapters at the same abstraction level. |

## Key Research Decisions

| Decision | Research Reference |
|----------|--------------------|
| TypeScript `interface` (not abstract class) for LayoutEngine | R1 |
| `mitt` for typed event emission | R2 |
| `useSyncExternalStore` for React ↔ engine bridge | R3 |
| Raw Konva (not react-konva) for Konva adapter | R4 |
| Both adapters fully imperative, same abstraction level | R4 |
| Domain model IS the common serialization format | R7 |
| Serialize/dispose/create/deserialize for engine switching | R8 |
| Shared contract test suite parameterized over both adapters | R9 |
| `capabilities()` method for feature discovery | R10 |
