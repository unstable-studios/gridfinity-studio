# Tasks: Layout Engine Abstraction

**Input**: Design documents from `/specs/009-layout-engine-abstraction/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/layout-engine.md, quickstart.md

**Tests**: Constitution mandates TDD (Principle III). Contract tests included per phase.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create directory structure, establish the layout-engine module

- [x] T001 Install mitt dependency via `pnpm add mitt` in package.json
- [x] T002 Create layout-engine module directory at src/renderer/src/layout-engine/

---

## Phase 2: Foundational (Types, Interface, Event System)

**Purpose**: Define all shared types and the LayoutEngine interface that both adapters must implement. MUST complete before any user story work.

**⚠️ CRITICAL**: No adapter or integration work can begin until this phase is complete.

- [x] T003 Define LayoutShape discriminated union type (rect, circle, polygon, svgPath, meshImport) with type-specific fields in src/renderer/src/layout-engine/types.ts
- [x] T004 Define LayoutGroup, GroupStyle, LayoutSnapshot, GridConfig, ViewportState, TransientState types in src/renderer/src/layout-engine/types.ts
- [x] T005 Define EngineEventMap typed event map (selectionChanged, shapeMoved, shapeResized, shapeCreated, shapeDeleted, groupChanged, viewportChanged) in src/renderer/src/layout-engine/types.ts
- [x] T006 Define LayoutEngine interface with all method signatures (lifecycle, shape CRUD, groups, selection, viewport, grid, events, serialization, transient state, capabilities, isInteracting) per contracts/layout-engine.md in src/renderer/src/layout-engine/interface.ts
- [x] T007 Create contract test suite skeleton with describe.each parameterized over adapter types, covering C1-C21 from contracts/layout-engine.md in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T008 Create createLayoutEngine factory function that instantiates the correct adapter by type string in src/renderer/src/layout-engine/create-engine.ts

**Checkpoint**: Types, interface, and contract test skeleton ready. Adapters can now be built in parallel.

---

## Phase 3: User Story 1 — Interact with Layout Shapes via Unified Interface (Priority: P1) 🎯 MVP

**Goal**: Both adapters implement the full LayoutEngine interface. User can place, move, resize, rotate, delete, group, and ungroup shapes. Sidebar reflects selection and properties via engine events.

**Independent Test**: Create a project, add shapes of each type, drag/resize/rotate, group into a bin, verify sidebar updates. Run contract tests against both adapters — all C1-C21 must pass.

### Contract Tests for US1

- [x] T009 [US1] Write contract tests C1-C4 (shape CRUD: add, get, getAll, update, remove) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T010 [US1] Write contract tests C5-C8 (group operations: create, remove/ungroup, addToGroup, removeFromGroup) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T011 [US1] Write contract tests C9-C11 (selection: select, clear, selectionChanged event) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T012 [US1] Write contract tests C12-C14 (viewport: panTo, zoomTo, resetView) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T013 [US1] Write contract tests C17-C19 (events: shapeCreated, shapeDeleted, unsubscribe) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T014 [US1] Write contract tests C20-C21 (lifecycle: dispose idempotent, no events after dispose) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts

### Fabric.js Adapter

- [x] T015 [P] [US1] Implement FabricEngine class with mount/dispose/resize lifecycle (create fabric.Canvas in mount, handle async dispose with guard ref, ResizeObserver) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T016 [P] [US1] Implement FabricEngine grid rendering (drawGrid helper, setGridConfig, getGridConfig) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T017 [US1] Implement FabricEngine shape CRUD (addShape mapping LayoutShape→fabric objects, updateShape, removeShape, getShape, getAllShapes) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T018 [US1] Implement FabricEngine group operations (createGroup with subTargetCheck+interactive, removeGroup via ungroupOnCanvas, addToGroup, removeFromGroup with coordinate recalculation) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T019 [US1] Implement FabricEngine selection (select via canvas.setActiveObject/ActiveSelection, addToSelection, clearSelection, getSelectedIds) and subscribe to selection:created/updated/cleared events in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T020 [US1] Implement FabricEngine viewport (panTo/zoomTo via viewportTransform, resetView, getViewport) and snap-to-grid (object:moving, object:scaling event handlers) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T021 [US1] Implement FabricEngine event emission via mitt (wire fabric events object:modified/moving/scaling to EngineEventMap, on() returns unsubscribe) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T022 [US1] Implement FabricEngine serialization (toSnapshot reads all fabric objects→LayoutShape[], loadSnapshot clears canvas and recreates) in src/renderer/src/layout-engine/fabric-engine.ts
- [x] T023 [US1] Implement FabricEngine transient state (getTransientState/setTransientState for selection+viewport), capabilities(), and isInteracting() in src/renderer/src/layout-engine/fabric-engine.ts

### Konva Adapter

- [x] T024 [P] [US1] Implement KonvaEngine class with mount/dispose/resize lifecycle (create Konva.Stage+Layer in mount, ResizeObserver, Transformer setup) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T025 [P] [US1] Implement KonvaEngine grid rendering (draw grid lines on background Layer, setGridConfig, getGridConfig) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T026 [US1] Implement KonvaEngine shape CRUD (addShape mapping LayoutShape→Konva nodes, updateShape via setAttrs, removeShape via destroy, getShape, getAllShapes) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T027 [US1] Implement KonvaEngine group operations (createGroup as Konva.Group with children, removeGroup with manual coordinate recalc via getAbsoluteTransform().invert(), addToGroup/removeFromGroup with moveTo+position fix) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T028 [US1] Implement KonvaEngine selection (click-to-select on stage mousedown, shift-click multi-select, rubber-band marquee ~30 lines, Transformer.nodes() for programmatic select, clearSelection) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T029 [US1] Implement KonvaEngine viewport (pan via stage position on alt+drag/middle-click, zoom via wheel with scaleX/scaleY, resetView, getViewport) and snap-to-grid (dragmove position rounding, anchorDragBoundFunc for resize snap) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T030 [US1] Implement KonvaEngine event emission via mitt (wire Konva events dragend/transformend/click to EngineEventMap, on() returns unsubscribe) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T031 [US1] Implement KonvaEngine serialization (toSnapshot reads all Konva nodes→LayoutShape[], loadSnapshot destroys all and recreates) in src/renderer/src/layout-engine/konva-engine.ts
- [x] T032 [US1] Implement KonvaEngine transient state (getTransientState/setTransientState), capabilities(), and isInteracting() in src/renderer/src/layout-engine/konva-engine.ts

### React Integration

- [x] T033 [US1] Create LayoutEngineContext with React.createContext and LayoutEngineProvider component that mounts/disposes engine on container ref in src/renderer/src/layout-engine/LayoutEngineContext.tsx
- [x] T034 [US1] Create useLayoutEngine() hook returning engine instance ref and useEngineState() hook using useSyncExternalStore for reactive reads (selection, viewport) in src/renderer/src/layout-engine/useLayoutEngine.ts
- [x] T035 [US1] Replace LayoutCanvas usage in Viewport.tsx with LayoutEngineProvider + container div, wire engine events to existing onPlace/onMove/onResize/onSelect handlers in src/renderer/src/components/Viewport.tsx
- [x] T036 [US1] Update Sidebar.tsx to read selected shape properties via useEngineState() and write updates via engine.updateShape() in src/renderer/src/components/Sidebar.tsx
- [x] T037 [US1] Update Navbar ToolBar to call engine.addShape() for create tools (rect, circle, polygon) and connect tool state in src/renderer/src/components/Navbar.tsx
- [x] T038 [US1] Run contract tests against both adapters, verify all C1-C21 pass for FabricEngine and KonvaEngine

**Checkpoint**: Both adapters fully implement the interface. Canvas interactions work via either engine. Contract tests pass. MVP complete.

---

## Phase 4: User Story 2 — Switch Rendering Engine at Runtime (Priority: P2)

**Goal**: User can switch between Fabric and Konva engines in preferences without losing any canvas state.

**Independent Test**: Create project with shapes and groups, switch engine via preference toggle, verify all objects/groups/viewport/selection survive the switch.

### Contract Tests for US2

- [x] T039 [US2] Write serialization roundtrip contract test C15 (add shapes+groups → toSnapshot → loadSnapshot → verify match) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T040 [US2] Write cross-engine roundtrip test (FabricEngine.toSnapshot → KonvaEngine.loadSnapshot → verify, and reverse) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts
- [x] T041 [US2] Write snapshot format test C16 (verify snapshot contains no engine-specific properties) in src/renderer/src/layout-engine/__tests__/layout-engine.contract.test.ts

### Implementation for US2

- [x] T042 [US2] Add engine type preference to useAppMode (engineType: 'fabric' | 'konva', setEngineType) with sessionStorage persistence in src/renderer/src/hooks/useAppMode.ts
- [x] T043 [US2] Implement engine switching logic in LayoutEngineProvider: on engineType change, capture snapshot+transient → dispose → create new engine → loadSnapshot → setTransientState in src/renderer/src/layout-engine/LayoutEngineContext.tsx
- [x] T044 [US2] Add isInteracting() guard to engine switch — disable preference toggle while drag/resize is in progress in src/renderer/src/layout-engine/LayoutEngineContext.tsx
- [x] T045 [US2] Add engine selector toggle to PreferencesModal or Navbar ViewModeToggle (Fabric.js / Konva radio or dropdown) in src/renderer/src/components/Navbar.tsx
- [x] T046 [US2] Remove the sandbox tab/toggle from Viewport and Navbar (replaced by real engine switching) in src/renderer/src/components/Viewport.tsx and src/renderer/src/components/Navbar.tsx
- [x] T047 [US2] Run cross-engine roundtrip tests, verify all shapes/groups/viewport survive Fabric→Konva and Konva→Fabric switches

**Checkpoint**: Engine switching works. User can toggle between engines with full state preservation.

---

## Phase 5: User Story 3 — Save and Load Projects Across Engines (Priority: P3)

**Goal**: Project files are engine-agnostic. Saved with one engine, loadable with the other.

**Independent Test**: Save project with Fabric, switch default to Konva, reload project, verify all data intact. And reverse.

### Implementation for US3

- [x] T048 [US3] Extend project schema in src/shared/types/project.ts to include LayoutSnapshot (shapes, groups, gridConfig) alongside or replacing existing entity/bin structure
- [x] T049 [US3] Update project save flow: on save, call engine.toSnapshot() and merge into project JSON in src/renderer/src/hooks/useProject.ts
- [x] T050 [US3] Update project load flow: on load, extract LayoutSnapshot from project JSON and call engine.loadSnapshot() in src/renderer/src/hooks/useProject.ts
- [x] T051 [US3] Add schema migration for existing .gfstudio files (convert old entities/bins format to LayoutSnapshot format) in src/shared/validation/project-validator.ts
- [x] T052 [US3] Write test: save project with Fabric → load with Konva → verify all shapes and groups match in src/renderer/src/layout-engine/__tests__/persistence.test.ts
- [x] T053 [US3] Write test: load a pre-migration .gfstudio file → verify it migrates and renders correctly in src/renderer/src/layout-engine/__tests__/persistence.test.ts

**Checkpoint**: Projects are fully engine-agnostic. Save/load works across engine switches and app restarts.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, performance validation, and documentation

- [x] T054 [P] Remove old LayoutCanvas, KonvaCanvas, KonvaBinGroup, KonvaToolManager, ShapeRenderer components that are replaced by the engine adapters in src/renderer/src/components/layout/
- [x] T055 [P] Remove sandbox prototype files (FabricSandbox.tsx, KonvaSandbox.tsx, sandbox/index.ts) in src/renderer/src/components/sandbox/
- [x] T056 [P] Verify no rendering-library types (fabric.*, Konva.*) are imported outside of fabric-engine.ts and konva-engine.ts via grep/lint rule
- [ ] T057 Run quickstart.md smoke test checklist end-to-end with both engines
- [ ] T058 Performance test: add 200+ shapes to canvas, verify drag/resize remains responsive (<16ms frame time) with both engines
- [x] T059 Run pnpm typecheck, pnpm lint, pnpm format — fix any issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2. Fabric and Konva adapters can be built in parallel (T015-T023 ∥ T024-T032). React integration follows both.
- **US2 (Phase 4)**: Depends on Phase 3 (both adapters must exist for switching)
- **US3 (Phase 5)**: Depends on Phase 3 (adapters must support serialization). Can run in parallel with US2.
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only. No dependency on other stories.
- **US2 (P2)**: Depends on US1 (both adapters must be complete to test switching).
- **US3 (P3)**: Depends on US1 (serialization must work). Can proceed in parallel with US2.

### Within User Story 1

- Contract tests (T009-T014) first — should FAIL before implementation
- Fabric adapter (T015-T023) and Konva adapter (T024-T032) in PARALLEL
- Within each adapter: lifecycle → grid → shape CRUD → groups → selection → viewport → events → serialization → transient/capabilities
- React integration (T033-T037) after both adapters pass contract tests
- Final validation (T038) last

### Parallel Opportunities

```
Phase 2: T003 ∥ T004 ∥ T005 (different sections of types.ts — can split)
Phase 3: T015-T023 (Fabric) ∥ T024-T032 (Konva) — different files, no deps
Phase 3: T009-T014 (contract tests) before T015+ (implementations)
Phase 4+5: US2 and US3 can proceed in parallel after US1
Phase 6: T054 ∥ T055 ∥ T056 — different files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational types + interface (T003-T008)
3. Complete Phase 3: Both adapters + React integration (T009-T038)
4. **STOP and VALIDATE**: Run contract tests, smoke test with both engines
5. Demo: working canvas with engine toggle in sandbox mode

### Incremental Delivery

1. Setup + Foundational → Types and interface locked
2. US1 → Both adapters work, canvas interactions functional (MVP!)
3. US2 → Runtime engine switching with state preservation
4. US3 → Engine-agnostic project persistence
5. Polish → Remove legacy code, validate performance

### Parallel Team Strategy

With two developers after Phase 2:
- **Developer A**: Fabric adapter (T015-T023)
- **Developer B**: Konva adapter (T024-T032)
- **Together**: React integration (T033-T037), then US2 and US3

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Constitution Principle III (TDD): Contract tests written FIRST, verified to FAIL, then implementations make them pass
- Constitution Principle VII (YAGNI): The adapter pattern is justified as the minimum design for swappable engines (see plan.md Complexity Tracking)
- Both adapters use raw imperative APIs (Fabric.js, raw Konva) — NOT react-konva (per research.md R4)
- Commit after each logical group of tasks using conventional commits (scope: core for types/interface, ui for adapters/integration)
