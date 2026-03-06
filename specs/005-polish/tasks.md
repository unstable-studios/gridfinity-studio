# Tasks: Polish & Cross-Cutting Concerns

**Input**: `specs/005-polish/spec.md`
**Prerequisites**: 002-undo-redo, 003-imports-patterns, 004-multi-bin-export substantially complete

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)

---

## Wall/Floor Thickness Analysis (#116)

- [ ] T132 [P] Write tests for thickness analysis (thin wall detection, thin floor detection, within-tolerance passes) in `src/renderer/src/lib/__tests__/analysis.test.ts`
- [ ] T133 Implement post-bake mesh analysis for thin walls and thin floor regions in `src/renderer/src/lib/analysis.ts`
- [ ] T134 Add 'analyze' message type to geometry worker for off-thread analysis in `src/renderer/src/workers/geometry.worker.ts`
- [ ] T135 Display analysis warnings in review mode (highlight thin regions, warning panel) in `src/renderer/src/components/review/BinPreview.tsx`

## Deterministic Output Tests (#117)

- [ ] T136 Write deterministic output tests: identical project inputs produce identical baked meshes (vertex-level tolerance comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`
- [ ] T137 Write deterministic export tests: identical baked meshes produce identical STL/3MF output (binary comparison) in `src/renderer/src/lib/__tests__/deterministic.test.ts`

## Example Projects (#118)

- [ ] T138 [P] Create example project: simple socket tray (SVG import + pattern) in `examples/socket-tray.gfstudio`
- [ ] T139 [P] Create example project: mixed asset tray (STL + 2D primitives) in `examples/mixed-assets.gfstudio`
- [ ] T140 [P] Create example project: multi-bin drawer organizer in `examples/drawer-organizer.gfstudio`

## Multi-Bin Packing (#120)

- [ ] T141 Write tests for multi-bin packing (partition by area, keep groups together, grid alignment) in `src/renderer/src/lib/__tests__/packing.test.ts`
- [ ] T142 Implement multi-bin packing algorithm: partition entities into grid-aligned bins with group constraints in `src/renderer/src/lib/packing.ts`
- [ ] T143 Add "Auto-pack" action in layout mode that creates bins from packing result in `src/renderer/src/components/layout/LayoutCanvas.tsx`

## Contextual Hints System

- [ ] T149a Create floating hint card component (anchored to bottom of viewport, semi-transparent, shows tool-specific guidance and keyboard shortcuts) in `src/renderer/src/components/HintCard.tsx`
- [ ] T149b Add hint content registry mapping each tool/mode to its hint text and shortcuts in `src/renderer/src/lib/hints.ts`
- [ ] T149c Mount HintCard in App layout, connect to `useAppMode().activeTool` to show context-specific hints in `src/renderer/src/App.tsx`

## Deferred Polish

- [ ] T176 Apply unit formatting to all displayed measurements (sidebar properties, grid labels, tooltip values) — show values in selected unit with automatic conversion in `src/renderer/src/lib/unit-format.ts` and `src/renderer/src/components/Sidebar.tsx`

## Final Validation

- [ ] T144 Run `pnpm typecheck` and fix any type errors across all new files
- [ ] T145 Run `pnpm lint` and fix any linting issues across all new files
- [ ] T146 Run `pnpm format` and fix any formatting issues across all new files
- [ ] T147 Run full test suite and verify all tests pass
- [ ] T148 Run quickstart.md validation: verify end-to-end workflow (draw -> extrude -> bake -> export) works

---

## Dependencies & Execution Order

1. T132-T135 (thickness analysis) — sequential, can start anytime after CSG builder
2. T136-T137 (deterministic tests) — need 3MF export from 004
3. T138-T140 (examples) — need SVG/STL import + patterns from 003
4. T141-T143 (packing) — need multi-bin from 004
5. T149a-T149c (hints) — independent, can start anytime
6. T176 (unit formatting) — independent, can start anytime
7. T144-T148 (final validation) — after everything else
