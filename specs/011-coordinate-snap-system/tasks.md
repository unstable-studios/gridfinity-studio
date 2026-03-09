# 011: Coordinate Snap System — Tasks

## Phase 1: Snap Infrastructure

- [ ] T001: Define `SnapConfig` type and `SnapPreferences` in shared types. Include fine/coarse steps for mm and inch, rotate angle.
- [ ] T002: Add snap preferences to app preferences store (persist to disk). Default: 1mm/5mm fine/coarse, 0.1in/0.5in, 15° rotate.
- [ ] T003: Add snap configuration UI to PreferencesModal — fine/coarse step inputs for both unit systems, rotate angle input.
- [ ] T004: Create `useSnapConfig()` hook that resolves the active snap step from project unit system + app preferences + current modifier key state.

## Phase 2: Drawing Tool Snap

- [ ] T005: Replace hardcoded 1mm snap in `DrawingToolLayer.tsx` with `useSnapConfig()`. Respect fine/coarse/free modifiers during draw.
- [ ] T006: Verify all three drawing tools (rect, circle, polygon) use the new snap system correctly.

## Phase 3: Engine Move Snap

- [ ] T007: Refactor Fabric `setupSnapToGrid()` — bins snap to module grid (as today), shapes snap to detail snap step based on modifier key.
- [ ] T008: Refactor Konva shape drag handlers — same logic as T007.
- [ ] T009: Implement absolute snap (forget off-grid offset) for shapes in both engines.
- [ ] T010: Implement selection-aware snap rules: shapes-only → detail snap, bins → module grid, mixed → module grid.

## Phase 4: Visual Grid

- [ ] T011: Render detail snap grid in Fabric engine — dotted/dashed lines at fine snap interval, distinct color from module grid.
- [ ] T012: Render detail snap grid in Konva engine — same visual treatment.
- [ ] T013: Zoom-adaptive visibility — fade out detail grid when lines would be < 4px apart on screen.

## Phase 5: Arrow Key Nudge

- [ ] T014: Implement arrow key nudge for selected shapes/bins. Fine step default, Shift for coarse, Alt for 1px.
- [ ] T015: Nudge respects selection snap rules (shapes use detail snap, bins use module grid).

## Phase 6: Future (not in initial scope)

- [ ] T016: Resize snap — Shift during resize snaps dragged edge/corner to detail grid.
- [ ] T017: Rotate snap — Shift during rotate snaps to configured angle increments.
- [ ] T018: Center snap — snap shape to center of containing bin.
- [ ] T019: User-space grouping (Cmd+G) — new group type, move/snap as unit.

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 | T001–T004 | Not started |
| 2 | T005–T006 | Not started |
| 3 | T007–T010 | Not started |
| 4 | T011–T013 | Not started |
| 5 | T014–T015 | Not started |
| 6 | T016–T019 | Future |
