# Tasks: Shape-to-Bin Assignment via Drag

**Input**: Design documents from `/specs/013-shape-drag-assignment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Extract shared utilities and add new event types

- [X] T001 Extract `findContainingBinGroup` from `src/renderer/src/components/DrawingToolLayer.tsx` into new shared utility `src/renderer/src/layout-engine/containment.ts` with the same AABB containment logic using lower-left corner convention
- [X] T002 Update `DrawingToolLayer.tsx` to import `findContainingBinGroup` from `src/renderer/src/layout-engine/containment.ts` instead of using the inline definition
- [X] T003 Add `shapeReassigned` event to `EngineEventMap` in `src/renderer/src/layout-engine/types.ts` with shape `{ shapeId: string, oldGroupId: string | null, newGroupId: string | null }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add highlight/unhighlight methods to group renderers — required by both drag assignment and visual feedback stories

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `highlight()` and `unhighlight()` methods to `FabricGroupRenderer` in `src/renderer/src/layout-engine/fabric-group-renderer.ts` — modify `__groupBg` stroke to blue (`#3b82f6`) with increased width on highlight, restore original stroke/width on unhighlight
- [X] T005 [P] Add `highlight()` and `unhighlight()` methods to `KonvaGroupRenderer` in `src/renderer/src/layout-engine/konva-group-renderer.ts` — same visual behavior as Fabric, using stored `origStroke`/`origStrokeWidth` for restore

**Checkpoint**: Foundation ready — highlight/unhighlight available on both renderers, containment utility extracted, shapeReassigned event defined

---

## Phase 3: User Story 1 — Drag Shape Into a Bin (Priority: P1) MVP

**Goal**: Dragging an ungrouped shape so its centroid lands inside a bin assigns the shape to that bin, preserving visual position

**Independent Test**: Create a bin, draw a shape outside it, drag the shape into the bin, verify sidebar shows it under the bin with no visual jump

### Implementation for User Story 1

- [X] T006 [US1] Add shape drag-end reassignment logic to Fabric engine in `src/renderer/src/layout-engine/fabric-engine.ts` — in the `object:modified` handler, after detecting a shape (via `SHAPE_DATA_KEY`), compute the shape's world-space centroid, call `findContainingBinGroup`, and if the target group differs from current `shape.groupId`, call `removeFromGroup` (if currently grouped) then `addToGroup` (if target bin exists). Emit `shapeReassigned` event and increment tick. Skip if object is an ActiveSelection (multi-select guard per FR-009).
- [X] T007 [US1] Add shape drag-end reassignment logic to Konva engine in `src/renderer/src/layout-engine/konva-engine.ts` — in the shape `dragend` handler (inside `addShape`), compute the shape's world-space position (use `node.getAbsolutePosition()` if grouped, `node.position()` if ungrouped), call `findContainingBinGroup`, and if the target group differs from current `shape.groupId`, call `removeFromGroup`/`addToGroup` as needed. Emit `shapeReassigned` event and increment tick. Skip if `transformer?.nodes().length > 1` (multi-select guard).
- [X] T008 [US1] Smoke test: run `pnpm dev`, create a bin, draw a rectangle outside it, drag the rectangle into the bin, verify sidebar updates and no visual jump. Test on both Fabric and Konva engines.

**Checkpoint**: Drag-in works on both engines. Shapes can be assigned to bins by dragging.

---

## Phase 4: User Story 2 — Drag Shape Out of a Bin (Priority: P1)

**Goal**: Dragging a grouped shape so its centroid lands outside all bins removes the shape from its bin

**Independent Test**: Create a bin with a shape, drag the shape outside, verify sidebar shows it ungrouped with no visual jump

### Implementation for User Story 2

- [X] T009 [US2] Verify drag-out works in Fabric engine — the reassignment logic from T006 should already handle this case (target bin is null, current groupId is set → `removeFromGroup` is called). If not, add the null-target path to `src/renderer/src/layout-engine/fabric-engine.ts`.
- [X] T010 [US2] Verify drag-out works in Konva engine — the reassignment logic from T007 should already handle this case. If not, add the null-target path to `src/renderer/src/layout-engine/konva-engine.ts`.
- [X] T011 [US2] Smoke test: run `pnpm dev`, create a bin with a shape inside it, drag the shape outside, verify sidebar updates and no visual jump. Also verify dragging within the same bin causes no change. Test on both engines.

**Checkpoint**: Drag-in and drag-out both work. Shapes can move freely between grouped and ungrouped states.

---

## Phase 5: User Story 3 — Drag Shape Between Bins (Priority: P2)

**Goal**: Dragging a shape from one bin directly into another transfers ownership in a single operation

**Independent Test**: Create two bins, draw a shape in the first, drag it into the second, verify sidebar shows it under the second bin

### Implementation for User Story 3

- [X] T012 [US3] Verify bin-to-bin transfer works in both engines — the reassignment logic from T006/T007 should handle this (old groupId differs from new groupId → `removeFromGroup` then `addToGroup`). If coordinate conversion causes a visual jump during bin-to-bin transfer, fix the world-space position preservation in `src/renderer/src/layout-engine/fabric-engine.ts` and `src/renderer/src/layout-engine/konva-engine.ts`.
- [X] T013 [US3] Smoke test: run `pnpm dev`, create two adjacent bins, draw a shape in the first, drag it into the second, verify sidebar updates and no visual jump. Test on both engines.

**Checkpoint**: All three reassignment paths work (in, out, between). Core feature complete.

---

## Phase 6: User Story 4 — Visual Feedback During Drag (Priority: P2)

**Goal**: During shape drag, the target bin under the shape's centroid is highlighted with a blue border in real time

**Independent Test**: Drag a shape across bins and verify the highlight follows the shape's centroid, appearing and disappearing as it enters and leaves bins

### Implementation for User Story 4

- [X] T014 [US4] Add drag-move highlight logic to Fabric engine in `src/renderer/src/layout-engine/fabric-engine.ts` — in the `object:moving` handler, when the moved object is a shape (not a group or ActiveSelection), compute its world-space centroid, call `findContainingBinGroup`, and highlight/unhighlight the target bin renderer. Track the currently highlighted group ID to avoid redundant updates. Clear highlight when centroid is outside all bins.
- [X] T015 [US4] Add drag-move highlight logic to Konva engine in `src/renderer/src/layout-engine/konva-engine.ts` — in the shape's `dragmove` handler (add one inside `addShape`), compute world-space position, call `findContainingBinGroup`, and highlight/unhighlight the target bin renderer. Track currently highlighted group ID. Clear highlight when centroid leaves all bins.
- [X] T016 [US4] Ensure highlight is cleared on drag end in both engines — after reassignment logic in T006/T007, call `unhighlight()` on any currently highlighted renderer and reset the tracked highlight ID. This prevents stale highlights if the user drops the shape.
- [X] T017 [US4] Smoke test: run `pnpm dev`, drag a shape across multiple bins, verify highlight appears on the bin under the centroid, transfers between bins, and disappears when over empty canvas. Test on both engines.

**Checkpoint**: Full feature complete — drag assignment with real-time visual feedback on both engines.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, edge cases, and cleanup

- [X] T018 Verify undo/redo works for all reassignment scenarios — drag in, drag out, drag between. The existing snapshot-based undo should capture groupId/childIds changes automatically. If not, ensure a snapshot is taken before reassignment in `src/renderer/src/layout-engine/fabric-engine.ts` and `src/renderer/src/layout-engine/konva-engine.ts`.
- [X] T019 Add tie-breaking logic to `findContainingBinGroup` in `src/renderer/src/layout-engine/containment.ts` — if a point is inside multiple bins (defensive edge case), return the bin whose center is closest to the point instead of the first match.
- [X] T020 Run full quickstart.md validation — execute all 6 scenarios from `specs/013-shape-drag-assignment/quickstart.md` on both engines and verify expected outcomes.
- [X] T021 Update CLAUDE.md recent changes section to document shape-to-bin drag assignment feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T003 (event type) — BLOCKS all user stories
- **US1 Drag In (Phase 3)**: Depends on Phase 2 — MVP target
- **US2 Drag Out (Phase 4)**: Depends on Phase 3 (shares reassignment logic)
- **US3 Drag Between (Phase 5)**: Depends on Phase 3 (shares reassignment logic)
- **US4 Visual Feedback (Phase 6)**: Depends on Phase 2 (highlight methods)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Shares reassignment logic with US1 — verify/extend after US1
- **US3 (P2)**: Shares reassignment logic with US1 — verify/extend after US1
- **US4 (P2)**: Can start after Foundational (only needs highlight methods) — independent of US1-3

### Parallel Opportunities

- T001, T003 can run in parallel (different files)
- T004, T005 can run in parallel (different renderer files)
- T014, T015 can run in parallel (different engine files)
- US4 (highlight) can be developed in parallel with US2/US3 (both depend on Phase 2 only)

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (extract utility, add event)
2. Complete Phase 2: Foundational (highlight methods on renderers)
3. Complete Phase 3: US1 — Drag into bin
4. Complete Phase 4: US2 — Drag out of bin
5. **STOP and VALIDATE**: Test drag-in and drag-out independently on both engines
6. This delivers the core value — shapes can move in and out of bins

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (drag in) → Test → Core assignment works (MVP!)
3. Add US2 (drag out) → Test → Full in/out workflow
4. Add US3 (drag between) → Test → Bin-to-bin transfer
5. Add US4 (highlight) → Test → Full UX with visual feedback
6. Polish → Undo verification, edge cases, docs

---

## Notes

- The reassignment logic in T006/T007 is designed to handle all three cases (in, out, between) — US2 and US3 are primarily verification/fix tasks
- Highlight methods (T004/T005) follow the established `flashCollision` pattern but use blue instead of red and are persistent (no timeout)
- Multi-select guard is critical — without it, dragging a multi-selection would reassign all shapes
- Coordinate conversion is handled by existing `addToGroup`/`removeFromGroup` — no new conversion code needed
