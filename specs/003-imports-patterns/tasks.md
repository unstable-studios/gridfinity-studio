# Tasks: Imports, Patterns & Layout Tools (US2)

**Input**: `specs/003-imports-patterns/spec.md`
**Prerequisites**: Phase 3.5 complete, 002-undo-redo recommended

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)

---

## Tests

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T090 [P] Write tests for SVG path parsing (simple paths, compound paths, transforms, degenerate cases) in `src/renderer/src/lib/__tests__/svg-import.test.ts`
- [ ] T091 [P] Write tests for linear pattern spacing (constant pitch, size-aware, explicit array) in `src/renderer/src/lib/__tests__/pattern.test.ts`
- [ ] T092 [P] Write tests for STL import (binary, ASCII, mesh entity creation) in `src/renderer/src/lib/__tests__/stl-io.test.ts`

## SVG Import (#91)

- [ ] T093 Implement SVG path parser using DOMParser + path segment to polygon conversion in `src/renderer/src/lib/svg-import.ts`
- [ ] T094 Create `import:svg` IPC handler with native file dialog (filter: .svg) in `src/main/import-handler.ts`
- [ ] T095 Register import IPC channels in preload bridge in `src/preload/index.ts` and `src/preload/index.d.ts`
- [ ] T096 Add Import SVG menu action and integrate with entity creation (onPlace -> addEntity) in `src/renderer/src/components/Navbar.tsx`

## STL Import (#104)

- [ ] T097 Implement STL import using Three.js STLLoader, create MeshEntity in `src/renderer/src/lib/stl-io.ts`
- [ ] T098 Create `import:stl` IPC handler with native file dialog (filter: .stl) in `src/main/import-handler.ts`
- [ ] T099 Add Import STL menu action in `src/renderer/src/components/Navbar.tsx`
- [ ] T100 Render imported STL meshes in layout mode (2D footprint projection) and review mode (full 3D) in `src/renderer/src/components/layout/EntityRenderer.tsx`

## Group Entities (#94)

- [ ] T101 Implement group/ungroup logic with hierarchical transforms in project state in `src/renderer/src/hooks/useProject.tsx`
- [ ] T102 Add Group/Ungroup commands to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T103 Add Group/Ungroup keyboard shortcuts (Cmd+G / Cmd+Shift+G) and menu items in `src/renderer/src/components/Navbar.tsx`

## Align & Distribute (#95, #96)

- [ ] T104 [P] Implement alignment actions (left, right, top, bottom, center-h, center-v) for selected entities in `src/renderer/src/lib/align.ts`
- [ ] T105 [P] Implement distribute actions (equal gaps X, equal gaps Y, optional grid-unit snap) for selected entities in `src/renderer/src/lib/distribute.ts`
- [ ] T106 Add align/distribute toolbar buttons (visible when 2+ entities selected) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

## Linear Pattern Generator (#97)

- [ ] T107 Implement linear pattern generator creating N instances along X or Y axis in `src/renderer/src/lib/pattern.ts`
- [ ] T108 Create PatternPanel UI (axis, count, spacing mode selector) in `src/renderer/src/components/patterns/PatternPanel.tsx`
- [ ] T109 Render pattern instances as instanced entities in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`
- [ ] T110 Integrate pattern generator with undo system (CreatePatternCommand) in `src/renderer/src/lib/undo.ts`

## Pattern Spacing Modes (#98, #99, #100)

- [ ] T111 Implement constant-pitch spacing mode (fixed distance between instances) in `src/renderer/src/lib/pattern.ts`
- [ ] T112 Implement size-aware spacing mode (bounding box + configurable gap) in `src/renderer/src/lib/pattern.ts`
- [ ] T113 Implement explicit-array spacing mode (per-instance position list) in `src/renderer/src/lib/pattern.ts`
- [ ] T114 Add spacing mode UI controls to PatternPanel (pitch input, gap input, position list editor) in `src/renderer/src/components/patterns/PatternPanel.tsx`

## Break Pattern Instance (#101)

- [ ] T115 Implement break-instance action: detach one generated instance into a manual entity in `src/renderer/src/lib/pattern.ts`
- [ ] T116 Add Break Instance context menu action for pattern instances in `src/renderer/src/components/layout/EntityRenderer.tsx`

## Snap System Overhaul

- [ ] T200 Refactor snap engine for per-axis resolution with multi-point sources (center, edges, corners per entity type) in `src/renderer/src/lib/snap.ts`
- [ ] T201 Implement screen-space threshold (convert pixel threshold to world units using camera zoom) in `src/renderer/src/lib/snap.ts`
- [ ] T202 Add alignment snap layer — detect shared X/Y coordinates between dragged and other objects, return guide line data in `src/renderer/src/lib/snap.ts`
- [ ] T203 Add bin edge snap layer — snap to bin footprint boundaries (left, right, top, bottom edges) in `src/renderer/src/lib/snap.ts`
- [ ] T204 Implement snap point extraction for all entity types (rectangles: 4 corners + 4 edge midpoints + center; circles: 4 cardinal + center; polygons: vertices + center) in `src/renderer/src/lib/snap.ts`
- [ ] T205 Create SnapGuides component to render alignment guide lines (dashed lines between aligned points) in `src/renderer/src/components/layout/SnapGuides.tsx`
- [ ] T206 Add snap configuration UI — toolbar toggles for each snap layer + preferences panel in `src/renderer/src/components/layout/SnapToolbar.tsx`
- [ ] T207 Integrate per-axis snap into TransformGizmo resize handles in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [ ] T208 Integrate snap into primitive tool placement (circle, rectangle, polygon tools) in `src/renderer/src/components/primitives/`
- [ ] T209 Add keyboard shortcut to temporarily disable snap (hold Ctrl) in `src/renderer/src/hooks/useSnapping.ts`

## Verification

- [ ] E2E: Import SVG -> create pattern with 5 instances -> verify spacing -> place in bin -> export -> all instances in mesh
- [ ] E2E: Import STL -> render in layout + review -> verify footprint projection

---

## Dependencies & Execution Order

1. T090-T092 (tests) — all parallel, write first
2. T093-T096 (SVG import) — sequential, needs T090 tests passing
3. T097-T100 (STL import) — parallel with SVG import, needs T092 tests
4. T101-T103 (grouping) — needs undo system from 002-undo-redo for T102
5. T104-T106 (align/distribute) — T104+T105 parallel, T106 depends on both
6. T107-T110 (pattern generator) — sequential, needs undo for T110
7. T111-T114 (spacing modes) — depends on T107
8. T115-T116 (break instance) — depends on T107
9. T200-T209 (snap overhaul) — can interleave with other work

### Parallel Opportunities

- T090 + T091 + T092 (all test files)
- T104 + T105 (align and distribute are different files)
- SVG import track + STL import track (independent pipelines)
- Snap overhaul can proceed in parallel with import/pattern work
