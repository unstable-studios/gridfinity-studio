# Tasks: Multi-Bin Layout & Export (US4)

**Input**: `specs/004-multi-bin-export/spec.md`
**Prerequisites**: Phase 3.5 complete, CSG bin generator complete

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)

---

## Tests

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T117 [P] Write tests for 3MF writer (valid ZIP structure, XML schema, mesh data) in `src/renderer/src/lib/__tests__/threemf-writer.test.ts`
- [x] T118 [P] Write tests for collision detection (overlapping footprints, non-overlapping, edge-touching) in `src/renderer/src/lib/__tests__/collision.test.ts`
- [x] T119 [P] Write tests for auto-wrap (minimal grid-aligned bin size for selection) in `src/renderer/src/lib/__tests__/auto-wrap.test.ts`

## Batch Export (#113)

- [x] T120 Create `export:batch` IPC handler with directory dialog and filename pattern in `src/main/export-handler.ts`
- [x] T122 Wire batch export into sidebar Review tab in `src/renderer/src/components/Sidebar.tsx`
- [ ] T121 Add dedicated ExportPanel with filename pattern and format selector in `src/renderer/src/components/export/ExportPanel.tsx` *(deferred: inline sidebar buttons sufficient for now)*

## 3MF Export (#119)

- [x] T123 Implement minimal 3MF writer (ZIP via jszip, XML model file, mesh data) in `src/renderer/src/lib/threemf-writer.ts`
- [x] T124 Create `export:3mf` IPC handler with native save dialog in `src/main/export-handler.ts`
- [x] T125 Add 3MF export button to sidebar Review tab in `src/renderer/src/components/Sidebar.tsx`

## Collision Detection (#115)

- [x] T126 Implement 2D footprint overlap detection for entities within a bin in `src/renderer/src/lib/collision.ts`
- [x] T127 Render collision warnings as visual indicators (red outlines) in layout mode in `src/renderer/src/components/layout/EntityRenderer.tsx`

## Gridfinity Keep-Out Visualization (#114)

- [x] T128 Calculate keep-out regions from GridfinityConfig (magnet circles, screw holes, lip inset) in `src/renderer/src/lib/keep-out.ts`
- [x] T129 Render keep-out zones as semi-transparent overlays in layout mode in `src/renderer/src/components/layout/KeepOutOverlay.tsx`

## Auto-Wrap Selection into Bin (#110)

- [x] T130 Implement auto-wrap: compute minimal grid-aligned bin dimensions for selected entities with margins in `src/renderer/src/lib/auto-wrap.ts`
- [x] T131 Add "Auto-wrap" action button in sidebar Bins section in `src/renderer/src/components/Sidebar.tsx`

## Multi-Bin Architecture (added during implementation)

- [x] T132 Per-bin bake results (Map<binId, BakeResult>) replacing single bakeResult in `src/renderer/src/hooks/useProject.tsx`
- [x] T133 Render all baked meshes positioned in 3D (per-bin offset) in `src/renderer/src/components/review/ReviewCanvas.tsx`
- [x] T134 BinBaker renders for ALL bins, not just first in `src/renderer/src/components/Sidebar.tsx`
- [x] T135 Fix prop leak on bin switch via key={bin.id} on BinProperties in `src/renderer/src/components/Sidebar.tsx`
- [x] T136 Clear stale bake results when bins removed in `src/renderer/src/components/Sidebar.tsx`

## Bin Collision Prevention (added during implementation)

- [x] T137 Bin-to-bin AABB collision helpers (binOverlapsAny, findNonOverlappingPosition, hasBinOverlaps) in `src/renderer/src/lib/collision.ts`
- [x] T138 Prevent bin overlap during drag in `src/renderer/src/components/layout/LayoutCanvas.tsx`
- [x] T139 Collision-aware Add Bin, Auto-wrap, and bin resize in `src/renderer/src/components/Sidebar.tsx`
- [x] T140 Block baking and show warning when bins overlap in `src/renderer/src/components/Sidebar.tsx`
- [x] T141 Lock baseUnit when bins exist in `src/renderer/src/components/settings/GridfinitySettings.tsx`

## Hierarchical Sidebar & Entity-Bin Ownership (added during implementation)

- [x] T142 Hierarchical bin/entity tree in sidebar (entities nested under parent bin, Unassigned section) in `src/renderer/src/components/Sidebar.tsx`
- [x] T143 Auto-wrap assigns entityIds and default pockets to new bin in `src/renderer/src/components/Sidebar.tsx`
- [x] T144 Auto-wrap only wraps unassigned entities in `src/renderer/src/components/Sidebar.tsx`
- [x] T145 Reassign entities to bins on drag end (onMoveEnd callback) in `src/renderer/src/components/Viewport.tsx`

## Verification

- [x] E2E: Create 3 bins of different sizes -> align to grid -> batch export as STL -> verify filenames and mesh validity
- [x] E2E: Place entities overlapping -> verify collision warnings -> fix overlap -> warnings clear
- [x] E2E: Select entities without bin -> Auto-wrap -> verify grid-aligned bin created

---

## Dependencies & Execution Order

1. T117-T119 (tests) — all parallel, write first ✅
2. T123-T125 (3MF export) — needs T117 tests ✅
3. T120, T122 (batch export) — independent track ✅
4. T126-T127 (collision) — needs T118 tests ✅
5. T128-T129 (keep-out) — independent of collision ✅
6. T130-T131 (auto-wrap) — needs T119 tests ✅
7. T132-T136 (multi-bin architecture) — depends on batch export ✅
8. T137-T141 (bin collision prevention) — depends on collision detection ✅
9. T142-T145 (hierarchical sidebar) — depends on multi-bin architecture ✅

### Remaining (deferred)

- T121 Dedicated ExportPanel component (current inline buttons are sufficient)

### Future Enhancements (filed as issues)

- #200 New Project dialog with baseUnit prompt
- #201 Multi-bin auto-wrap via spatial clustering
- #202 Pocket depth exceeds bin cavity warning
- #203 Project name as tree root, inline "+ Add Bin"
- #204 Right-click context menu
- #205 Multi-select (shift/cmd+click)
- #206 Bin canvas resize handles
- #207 Auto-wrap selected items
- #208 Realistic bin footprint rendering
- #209 MxN grid picker for bin sizing
