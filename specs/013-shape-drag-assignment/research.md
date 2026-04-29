# Research: Shape-to-Bin Assignment via Drag

## R1: Coordinate Conversion During Group Reassignment

**Decision**: Reuse existing `addToGroup`/`removeFromGroup` implementations — they already handle coordinate conversion correctly.

**Rationale**: Both engines solve the world ↔ group-local problem:
- **Fabric** (`addToGroup`): `canvas.remove(obj)` + `group.add(obj)` — Fabric's internal transform pipeline handles repositioning automatically when adding/removing from groups.
- **Fabric** (`removeFromGroup`): Uses `obj.calcTransformMatrix()` to extract world position before removing from group, then sets `left/top` to the world coords and calls `setCoords()`.
- **Konva** (`addToGroup`): Captures `node.x()/y()` (absolute), calls `node.moveTo(group)`, then sets position to `absPos - groupPos` for group-local coords.
- **Konva** (`removeFromGroup`): Uses `node.getAbsolutePosition()` before `moveTo(mainLayer)`, then restores absolute position.

**Alternatives considered**: Writing a shared coordinate conversion utility. Rejected because each engine already has the correct conversion baked into its add/remove methods.

## R2: Drag Hook Points

**Decision**: Hook into existing drag-end events; add drag-move hooks for highlighting.

**Rationale**:
- **Fabric**: `object:modified` fires after any drag/resize completes. Shape detection via `SHAPE_DATA_KEY`. Add containment check after existing position/size emission.
- **Konva**: `dragend` handler in `addShape()`. Currently updates `data.x/y` and emits `shapeMoved`. Add containment check after position update.
- **Drag-move for highlighting**: Fabric has `object:moving`, Konva has `dragmove`. Both fire continuously during drag — suitable for real-time highlight updates.

**Alternatives considered**: Using a separate event listener or polling. Rejected — hooking into existing event flow is simpler and more reliable.

## R3: Containment Check Extraction

**Decision**: Extract `findContainingBinGroup` from `DrawingToolLayer.tsx` into `containment.ts`.

**Rationale**: The function is pure (takes engine + world coords, returns group or null). Currently defined as a module-level function in DrawingToolLayer. Moving it to the layout-engine directory makes it importable by both engine adapters.

Enhancement: Add a tie-breaking parameter for the edge case where a point is inside multiple bins (closest center wins). In practice, bins can't overlap due to collision detection, so this is defensive.

**Alternatives considered**: Duplicating the logic in each engine. Rejected — violates DRY and makes it harder to update the containment algorithm.

## R4: Highlight Approach

**Decision**: Use stroke modification on the `__groupBg` rect, following the collision flash pattern.

**Rationale**: Both engines already have a `flashCollision` method that modifies the background rect's stroke. The highlight uses the same approach but with:
- Different color: blue (`#3b82f6`) instead of red (`#ef4444`)
- Persistent during drag (no timeout) instead of 300ms flash
- Explicit `unhighlight()` method to restore original stroke

Group renderers already store original stroke values (`origStroke`, `origStrokeWidth` in Konva; captured inline in Fabric). Highlight/unhighlight methods will follow the same pattern.

**Alternatives considered**:
- CSS overlay on the container div — rejected, doesn't respect canvas zoom/pan.
- Separate Konva/Fabric overlay shape — adds complexity for no benefit.
- Opacity change on the group — doesn't provide clear enough feedback.

## R5: Multi-Select Guard

**Decision**: Check for multi-select state before triggering reassignment.

**Rationale**:
- **Fabric**: In `object:modified`, check if `obj instanceof fabric.ActiveSelection` — if so, skip shape reassignment. This is already how collision detection is guarded.
- **Konva**: In the shape's `dragend`, check `this.transformer?.nodes().length > 1` — if so, skip.

Single-shape drag reassignment is the intended behavior per spec (FR-009).

## R6: Event Emission

**Decision**: Add `shapeReassigned` event to `EngineEventMap` for sidebar reactivity.

**Rationale**: The existing `shapeMoved` event fires on position change but doesn't indicate group membership change. A distinct `shapeReassigned` event with `{ shapeId, oldGroupId, newGroupId }` allows the sidebar (and any future consumers) to react specifically to reassignment. The tick counter increment already triggers `useSyncExternalStore` re-renders.

**Alternatives considered**: Relying solely on tick increment without a specific event. Viable but less informative — a dedicated event is cleaner for debugging and future extensibility.
