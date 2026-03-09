# Tasks: Input Handling Decoupling

**Input**: Design documents from `/specs/012-input-decoupling/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new interfaces, types, and pure functions that all user stories depend on

- [x] T001 [P] Create InputActionHandler interface and HitResult type in `src/renderer/src/layout-engine/input-action-handler.ts` per contracts/input-action-handler.ts
- [x] T002 [P] Create pure math functions (snapLowerLeft, quantizeResize, computeEdgeAnchor) in `src/renderer/src/layout-engine/input-math.ts` per contracts/input-math.ts
- [x] T003 Write unit tests for all input-math functions in `src/renderer/src/layout-engine/__tests__/input-math.test.ts` — cover grid snap, resize quantization, edge-anchor from all four corners

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the LayoutEngine interface, implement new methods in both engines, create the GestureRecognizer skeleton

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend LayoutEngine interface in `src/renderer/src/layout-engine/interface.ts` — add objectAt, objectsInRect, setDragEnabled, screenToWorld methods
- [x] T005 [P] Implement objectAt, objectsInRect, setDragEnabled, screenToWorld in `src/renderer/src/layout-engine/fabric-engine.ts` — objectAt uses Fabric's findTarget, objectsInRect uses AABB on fabricMap, setDragEnabled toggles canvas.selection, screenToWorld inverts viewportTransform
- [x] T006 [P] Implement objectAt, objectsInRect, setDragEnabled, screenToWorld in `src/renderer/src/layout-engine/konva-engine.ts` — objectAt uses stage.getIntersection or konvaMap iteration, objectsInRect uses getClientRect AABB, setDragEnabled sets flag checked by drag handlers, screenToWorld inverts stage position+scale
- [x] T007 Create GestureRecognizer class skeleton in `src/renderer/src/layout-engine/gesture-recognizer.ts` — state machine (idle/panning/dragReady/rubberBand), attach/dispose/cancel lifecycle, capture-phase DOM listener registration per contracts/gesture-recognizer.ts
- [x] T008 Wire GestureRecognizer into `src/renderer/src/layout-engine/LayoutEngineContext.tsx` — instantiate on mount, call setActionHandler on engine switch, dispose on unmount, cancel on engine change

**Checkpoint**: Foundation ready — GestureRecognizer skeleton in place, engines expose new interface methods

---

## Phase 3: User Story 1 — Canvas Navigation Consistency (Priority: P1) 🎯 MVP

**Goal**: Pan and zoom work identically across both engines, driven by the shared GestureRecognizer

**Independent Test**: Switch between Fabric and Konva engines, verify Alt-drag pan, middle-click pan, and scroll-wheel zoom all behave identically (modifier keys, zoom range 0.1x–10x, cursor-center zoom)

### Implementation for User Story 1

- [x] T009 [US1] Implement pan gesture detection in `src/renderer/src/layout-engine/gesture-recognizer.ts` — detect Alt+primary and middle-click, transition idle→panning, emit panStart/panMove/panEnd, handle window blur reset
- [x] T010 [US1] Implement zoom gesture detection in `src/renderer/src/layout-engine/gesture-recognizer.ts` — wheel event with cursor center, call handler.applyZoom
- [x] T011 [P] [US1] Implement applyPan and applyZoom in `src/renderer/src/layout-engine/fabric-engine.ts` — applyPan updates viewportTransform[4]/[5], applyZoom uses zoomToPoint with clamp 0.1–10, emit viewportChanged
- [x] T012 [P] [US1] Implement applyPan and applyZoom in `src/renderer/src/layout-engine/konva-engine.ts` — applyPan updates stage.position(), applyZoom computes mousePointTo and stage.scale() with clamp 0.1–10, emit viewportChanged
- [x] T013 [US1] Implement pan drag suppression in GestureRecognizer — call handler.setDragEnabled(false) on panStart, handler.setDragEnabled(true) on panEnd
- [x] T014 [US1] Remove old setupPanZoom() from `src/renderer/src/layout-engine/fabric-engine.ts` — delete mouse:down/move/up pan handlers and mouse:wheel handler; remove panCaptureHandler DOM listener
- [x] T015 [US1] Remove old setupPanZoom() from `src/renderer/src/layout-engine/konva-engine.ts` — delete capture-phase mousedown handler, stage mousemove/mouseup pan handlers, stage wheel handler; remove isPanning and lastPointer fields

**Checkpoint**: Pan and zoom work via GestureRecognizer in both engines. Old pan/zoom code removed.

---

## Phase 4: User Story 2 — Selection Behavior Parity (Priority: P1)

**Goal**: Click-select, shift-click, and rubber-band selection work identically across both engines

**Independent Test**: In both engines: click shape → selected; shift-click another → both selected; shift-click first → deselected; drag on empty canvas → rubber-band selects intersecting shapes; click empty → clears

### Implementation for User Story 2

- [x] T016 [US2] Implement click-select gesture in `src/renderer/src/layout-engine/gesture-recognizer.ts` — on primary click (no drag past threshold), call handler.objectAt to get target, dispatch clickSelect or clearSelect. Handle shift modifier for add/remove-from-selection.
- [x] T017 [US2] Implement rubber-band gesture in `src/renderer/src/layout-engine/gesture-recognizer.ts` — primary press on empty canvas + drag past 5px threshold → rubberBandStart, rubberBandMove (compute world-space rect), rubberBandEnd. Handle Alt mid-rubber-band → cancel and switch to pan.
- [x] T018 [P] [US2] Implement showRubberBand/hideRubberBand in `src/renderer/src/layout-engine/fabric-engine.ts` — render dashed rect on the Fabric canvas (non-selectable, non-interactive), remove on hide
- [x] T019 [P] [US2] Implement showRubberBand/hideRubberBand in `src/renderer/src/layout-engine/konva-engine.ts` — render dashed rect on mainLayer, remove on hide
- [x] T020 [US2] Wire rubber-band finalization — on rubberBandEnd, call handler.objectsInRect(rect) and handler.selectIds(hits), then handler.hideRubberBand()
- [x] T021 [US2] Wire click-select finalization — on clickSelect, call handler.selectIds([targetId]) or handler.addToSelection/removeFromSelection based on shift state and current selection
- [x] T022 [US2] Remove old rubber-band selection code from `src/renderer/src/layout-engine/konva-engine.ts` — delete selectionRect, selectionStart fields, mousedown/mousemove/mouseup rubber-band handlers
- [x] T023 [US2] Remove old click-select handlers from `src/renderer/src/layout-engine/konva-engine.ts` — delete shape click-select logic (shift-click add/remove), keep Fabric's built-in selection events (they still emit selectionChanged)

**Checkpoint**: Selection works via GestureRecognizer. Both engines have rubber-band. Old manual selection code removed from Konva.

---

## Phase 5: User Story 3 — Group Drag with Snap and Collision (Priority: P1)

**Goal**: Bin group dragging uses shared snap math; shapes move freely. Identical across engines.

**Independent Test**: Drag a bin group → snaps to grid. Drag into another group → reverts with red flash. Drag a shape → moves freely. Multi-select drag works in both engines.

### Implementation for User Story 3

- [x] T024 [P] [US3] Replace inline snapToGrid in `src/renderer/src/layout-engine/fabric-group-renderer.ts` — import and use snapLowerLeft from input-math.ts instead of inline snap formula
- [x] T025 [P] [US3] Replace inline snapToGrid in `src/renderer/src/layout-engine/konva-group-renderer.ts` — import and use snapLowerLeft from input-math.ts instead of inline snap formula
- [x] T026 [US3] Verify setDragEnabled correctly suppresses shape dragging during pan in both engines — ensure Fabric toggles canvas.selection, Konva checks the flag in dragstart handlers instead of toggling draggable() on every node

**Checkpoint**: Group snap uses shared math. Shapes move freely. Pan suppression works without per-node draggable() toggling.

---

## Phase 6: User Story 4 — Group Resize with Edge Anchoring (Priority: P2)

**Goal**: Resize preview overlay, edge-anchor calculation, and dimension quantization use shared pure functions

**Independent Test**: Resize a group from each edge/corner → opposite edge stays fixed. Dimensions snap to grid. Collision turns overlay red and reverts on release.

### Implementation for User Story 4

- [x] T027 [P] [US4] Replace edge-anchor computation in `src/renderer/src/layout-engine/fabric-engine.ts` — import computeEdgeAnchor from input-math.ts, replace ~40 lines of inline edge-detection + position math in object:scaling and object:modified handlers
- [x] T028 [P] [US4] Replace edge-anchor computation in `src/renderer/src/layout-engine/konva-group-renderer.ts` — import computeEdgeAnchor from input-math.ts, replace ~40 lines in updateResizeOverlay and transformend handlers
- [x] T029 [P] [US4] Replace resize dimension quantization in both engines — import quantizeResize from input-math.ts, replace inline Math.max(gs, Math.round(w/gs)*gs) patterns

**Checkpoint**: Resize logic uses shared math. Edge-anchor and overlay behavior identical across engines.

---

## Phase 7: User Story 5 — New Engine Adapter Simplicity (Priority: P3)

**Goal**: Verify the InputActionHandler interface is complete and self-documenting; a new engine only implements rendering, not gestures

**Independent Test**: Review InputActionHandler — all methods are engine-specific rendering commands; no gesture detection, snap math, or collision logic in the interface

### Implementation for User Story 5

- [x] T030 [US5] Audit both engine files for remaining duplicated input logic — identify any gesture/input code that survived the extraction and move to GestureRecognizer or input-math.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, export updates, validation

- [x] T031 [P] Update exports in `src/renderer/src/layout-engine/index.ts` — export GestureRecognizer, InputActionHandler, input-math functions
- [x] T032 Run existing contract test suite (`pnpm typecheck && pnpm lint`) — verify zero regressions
- [x] T033 Run cross-engine roundtrip tests in `src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts` — all existing assertions pass unchanged
- [x] T034 Measure code reduction — count lines removed from engine files vs lines added to new files; verify SC-002 (≥50% reduction in duplicated input code)
- [ ] T035 Final smoke test — pan, zoom, click-select, shift-select, rubber-band, drag+snap, resize+anchor, collision, undo/redo, engine switch, project save/load

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 Pan/Zoom (Phase 3)**: Depends on Foundational — can start first
- **US2 Selection (Phase 4)**: Depends on Foundational — can run in parallel with US1
- **US3 Drag Snap (Phase 5)**: Depends on Foundational + input-math (T002/T003) — can run in parallel with US1/US2
- **US4 Resize (Phase 6)**: Depends on Foundational + input-math — can run in parallel with US1/US2/US3
- **US5 Audit (Phase 7)**: Depends on US1–US4 completion
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories. First priority — establishes the GestureRecognizer's core loop.
- **US2 (P1)**: No dependency on US1 — adds gesture types to the recognizer independently.
- **US3 (P1)**: No dependency on US1/US2 — only needs input-math.ts from Setup.
- **US4 (P2)**: No dependency on US1/US2/US3 — only needs input-math.ts from Setup.
- **US5 (P3)**: Depends on US1–US4 — audit can only happen after extraction is complete.

### Within Each User Story

- Implement engine methods before removing old code
- Remove old code only after new path is verified working
- Checkpoint verification before marking story complete

### Parallel Opportunities

- T001 + T002 (Setup: interface + math) in parallel
- T005 + T006 (Foundational: Fabric + Konva interface impl) in parallel
- T011 + T012 (US1: Fabric + Konva pan/zoom impl) in parallel
- T018 + T019 (US2: Fabric + Konva rubber-band impl) in parallel
- T024 + T025 (US3: Fabric + Konva snap replacement) in parallel
- T027 + T028 + T029 (US4: all edge-anchor replacements) in parallel
- After Foundational: US1, US2, US3, US4 can all proceed in parallel

---

## Parallel Example: User Story 1

```bash
# Launch Fabric + Konva implementations together:
Task: "T011 Implement applyPan and applyZoom in fabric-engine.ts"
Task: "T012 Implement applyPan and applyZoom in konva-engine.ts"

# Then sequentially: remove old code from each
Task: "T014 Remove old setupPanZoom from fabric-engine.ts"
Task: "T015 Remove old setupPanZoom from konva-engine.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: User Story 1 — Pan/Zoom (T009–T015)
4. **STOP and VALIDATE**: Pan and zoom work via GestureRecognizer in both engines
5. Commit and verify CI passes

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Pan/Zoom) → Verify → Commit (MVP!)
3. Add US2 (Selection) → Verify → Commit
4. Add US3 (Drag Snap) → Verify → Commit
5. Add US4 (Resize) → Verify → Commit
6. US5 Audit + Polish → Final verification → PR

### Risk Mitigation

- **Highest risk**: Pan suppression (T013) — if setDragEnabled doesn't prevent shapes from moving during pan, the whole gesture system breaks. Test this early.
- **Medium risk**: Rubber-band selection (T17–T20) — currently Konva-only. Adding to Fabric is new behavior.
- **Low risk**: Math extraction (T024–T029) — pure refactor, existing behavior preserved by contract tests.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase checkpoint
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
