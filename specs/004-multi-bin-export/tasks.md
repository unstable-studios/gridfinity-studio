# Tasks: Multi-Bin Layout & Export (US4)

**Input**: `specs/004-multi-bin-export/spec.md`
**Prerequisites**: Phase 3.5 complete, CSG bin generator complete

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)

---

## Tests

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T117 [P] Write tests for 3MF writer (valid ZIP structure, XML schema, mesh data) in `src/renderer/src/lib/__tests__/threemf-writer.test.ts`
- [ ] T118 [P] Write tests for collision detection (overlapping footprints, non-overlapping, edge-touching) in `src/renderer/src/lib/__tests__/collision.test.ts`
- [ ] T119 [P] Write tests for auto-wrap (minimal grid-aligned bin size for selection) in `src/renderer/src/lib/__tests__/auto-wrap.test.ts`

## Batch Export (#113)

- [ ] T120 Create `export:batch` IPC handler with directory dialog and filename pattern in `src/main/export-handler.ts`
- [ ] T121 Add batch export UI (all bins / selected bins, filename pattern, format selector) in `src/renderer/src/components/export/ExportPanel.tsx`
- [ ] T122 Wire ExportPanel into sidebar Export tab in `src/renderer/src/components/Sidebar.tsx`

## 3MF Export (#119)

- [ ] T123 Implement minimal 3MF writer (ZIP via jszip, XML model file, mesh data) in `src/renderer/src/lib/threemf-writer.ts`
- [ ] T124 Create `export:3mf` IPC handler with native save dialog in `src/main/export-handler.ts`
- [ ] T125 Add 3MF format option to export panel and single-export toolbar in `src/renderer/src/components/export/ExportPanel.tsx`

## Collision Detection (#115)

- [ ] T126 Implement 2D footprint overlap detection for entities within a bin in `src/renderer/src/lib/collision.ts`
- [ ] T127 Render collision warnings as visual indicators (red outlines) in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`

## Gridfinity Keep-Out Visualization (#114)

- [ ] T128 Calculate keep-out regions from GridfinityConfig (magnet circles, screw holes, lip inset) in `src/renderer/src/lib/keep-out.ts`
- [ ] T129 Render keep-out zones as semi-transparent overlays in layout and review modes in `src/renderer/src/components/layout/GridOverlay.tsx`

## Auto-Wrap Selection into Bin (#110)

- [ ] T130 Implement auto-wrap: compute minimal grid-aligned bin dimensions for selected entities with margins in `src/renderer/src/lib/auto-wrap.ts`
- [ ] T131 Add "Auto-wrap" action button (visible when entities selected without a bin) in `src/renderer/src/components/layout/LayoutCanvas.tsx`

## Verification

- [ ] E2E: Create 3 bins of different sizes -> align to grid -> batch export as STL -> verify filenames and mesh validity
- [ ] E2E: Place entities overlapping -> verify collision warnings -> fix overlap -> warnings clear
- [ ] E2E: Select entities without bin -> Auto-wrap -> verify grid-aligned bin created

---

## Dependencies & Execution Order

1. T117-T119 (tests) — all parallel, write first
2. T123-T125 (3MF export) — needs T117 tests, independent track
3. T120-T122 (batch export) — independent track, can parallel with 3MF
4. T126-T127 (collision) — needs T118 tests
5. T128-T129 (keep-out) — independent of collision
6. T130-T131 (auto-wrap) — needs T119 tests

### Parallel Opportunities

- T117 + T118 + T119 (all test files)
- 3MF track + batch export track + collision track (all independent)
- Keep-out visualization can run in parallel with everything
