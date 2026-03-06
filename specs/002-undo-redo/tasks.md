# Tasks: Undo/Redo System (US3)

**Input**: `specs/002-undo-redo/spec.md`
**Prerequisites**: Phase 3.5 complete (controlled inputs, resize handles, CSG bin generator)

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)

---

## Tests

- [ ] T081 [P] Write integration tests for undo across entity create/delete/move/rotate/parameter-edit in `src/renderer/src/lib/__tests__/undo-integration.test.ts`

## Implementation

- [ ] T082 Add CreateEntityCommand and DeleteEntityCommand to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T083 Add MoveCommand and RotateCommand (captures old/new transform) to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T084 Add UpdateParameterCommand (captures old/new values for any entity field) to undo system in `src/renderer/src/lib/undo.ts`
- [ ] T085 Integrate undo commands into all primitive creation tools (circle, rectangle, polygon) in `src/renderer/src/components/primitives/CircleTool.tsx`, `RectangleTool.tsx`, `PolygonTool.tsx`
- [ ] T086 Integrate undo commands into TransformGizmo move/rotate operations in `src/renderer/src/components/layout/TransformGizmo.tsx`
- [ ] T087 Integrate undo commands into extrusion and bin parameter changes in `src/renderer/src/components/Sidebar.tsx`
- [ ] T088 Clear undo history on project load/new in `src/renderer/src/hooks/useProject.tsx`
- [ ] T089 Add undo/redo status to navbar (showing last action label, disabled state) in `src/renderer/src/components/Navbar.tsx`

## Verification

- [ ] E2E: Create entity → move it → change parameters → undo each step → verify state reverts correctly → redo → verify state restores

---

## Dependencies & Execution Order

1. T081 (tests) — write first, ensure they fail
2. T082-T084 (command classes) — can be parallel, all in `undo.ts`
3. T085-T087 (integration) — depend on T082-T084, can be parallel across files
4. T088 (history clear) — independent
5. T089 (navbar status) — depends on T082-T084 for command types
