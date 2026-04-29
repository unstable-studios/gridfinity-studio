# Implementation Plan: Shape-to-Bin Assignment via Drag

**Branch**: `013-shape-drag-assignment` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-shape-drag-assignment/spec.md`

## Summary

Enable real-time shape-to-bin assignment during drag. When a shape drag ends, evaluate the shape's centroid against all bin boundaries and reassign group membership accordingly. During drag, highlight the target bin under the shape's centroid. Both Fabric and Konva engines must behave identically.

The core approach:
1. Extract `findContainingBinGroup` from DrawingToolLayer into a shared utility
2. Hook into each engine's shape drag-end handler to evaluate and reassign group membership
3. Hook into each engine's shape drag-move handler to highlight the target bin
4. Existing `addToGroup`/`removeFromGroup` already handle coordinate conversion — reuse them

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, no `any`)
**Primary Dependencies**: Fabric.js v7, Konva 10, React 19, mitt (event emitter)
**Storage**: N/A (renderer-only feature, snapshots already capture groupId/childIds)
**Testing**: Vitest (contract tests exist for addToGroup/removeFromGroup)
**Target Platform**: Electron 39 desktop (macOS, Linux, Windows)
**Project Type**: Desktop application (Electron + React)
**Performance Goals**: 60fps during drag — highlight updates must not cause jank
**Constraints**: No visual jump when reassigning; centroid-based containment; both engines identical
**Scale/Scope**: Typically <50 shapes and <20 bins per project

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Type Safety | PASS | All new code strict TS, no `any`. Existing typed interfaces reused. |
| II. Electron Process Isolation | PASS | Renderer-only feature. No IPC or main process changes. |
| III. Test-First Development | PASS | Contract tests exist for addToGroup/removeFromGroup. New containment logic will have unit tests. Visual highlight is UI-only (exception per constitution). |
| IV. 3D Performance | N/A | 2D canvas feature, no Three.js involvement. |
| V. UX & Accessibility | PASS | Visual highlight provides affordance. No color-only indicators (highlight uses border + width change). Undo/redo supported via existing snapshots. |
| VI. Conventional Commits | PASS | Standard workflow. |
| VII. Adapter-Based Modularity | PASS | Feature extends both engine adapters identically. Shared containment logic is engine-agnostic. Interface extended minimally. |
| VIII. Simplicity & YAGNI | PASS | No new abstractions — hooks into existing drag handlers and reuses existing addToGroup/removeFromGroup. Shared utility extracted from existing code, not invented. |

No violations. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-shape-drag-assignment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/src/layout-engine/
├── containment.ts           # NEW — extracted findContainingBinGroup + centroid helpers
├── fabric-engine.ts         # MODIFY — hook shape drag-end for reassignment, drag-move for highlight
├── konva-engine.ts          # MODIFY — hook shape drag-end for reassignment, drag-move for highlight
├── fabric-group-renderer.ts # MODIFY — add highlight/unhighlight methods
├── konva-group-renderer.ts  # MODIFY — add highlight/unhighlight methods
├── interface.ts             # No changes needed — addToGroup/removeFromGroup already exist
└── types.ts                 # MODIFY — add shapeReassigned event to EngineEventMap

src/renderer/src/components/
├── DrawingToolLayer.tsx     # MODIFY — replace inline findContainingBinGroup with import from containment.ts
```

**Structure Decision**: No new directories or patterns. One new shared utility file (`containment.ts`), modifications to existing engine adapters and renderers.

## Architecture

### Drag Assignment Flow

```
Shape drag starts
  │
  ├─ dragmove (continuous) ──→ compute shape centroid world position
  │                            ──→ findContainingBinGroup(centroid)
  │                            ──→ highlight target bin (or clear highlight)
  │
  └─ dragend (once) ──→ compute shape centroid world position
                        ──→ findContainingBinGroup(centroid)
                        ──→ compare with current shape.groupId
                        ──→ if different: removeFromGroup (if needed) + addToGroup (if needed)
                        ──→ clear any highlight
                        ──→ emit shapeReassigned event
                        ──→ tick++ (triggers sidebar reactivity)
```

### Coordinate Conversion (already handled)

Both engines' `addToGroup`/`removeFromGroup` handle world ↔ group-local conversion:
- **Fabric**: `calcTransformMatrix()` extracts world position; `group.add()` handles internal transform
- **Konva**: `getAbsolutePosition()` gets world position; manual offset `worldPos - groupPos` for group-local

No new coordinate logic needed.

### Highlight Pattern

Follow the existing `flashCollision` approach but without a timeout — highlight stays active during drag:
- Find `__groupBg` rect in the target bin
- Change stroke to a highlight color (e.g., `#3b82f6` blue, distinct from collision red `#ef4444`)
- Increase stroke width
- On unhighlight: restore original stroke/width
- Track currently highlighted group ID to avoid redundant updates

### Multi-Select Guard

Shape reassignment MUST only trigger for individual shape drags:
- **Fabric**: Check if the dragged object is an ActiveSelection — skip reassignment if so
- **Konva**: Check if transformer has multiple nodes — skip reassignment if so

## Complexity Tracking

No violations — table not needed.
