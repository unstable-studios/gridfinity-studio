# Research: Input Handling Decoupling

## R1: Gesture Recognizer Attachment Point

**Decision**: DOM capture-phase listeners on the engine container div.

**Rationale**: Konva already uses this pattern (`container.addEventListener('mousedown', handler, true)`) to intercept pan before Konva's internal drag system. Fabric's events go through its canvas wrapper which is a child of the container. Attaching at the container capture phase intercepts events before either engine sees them, giving the gesture recognizer full control over disambiguation (pan vs drag vs select vs rubber-band).

**Alternatives considered**:
- Engine-level event hooks (adding a pre-handler interface): Rejected because it couples the gesture recognizer to each engine's event model.
- Post-engine event consumption: Rejected because it can't _prevent_ engine actions (e.g., preventing drag during pan).

## R2: Hit-Testing Strategy

**Decision**: Add `objectAt(worldX, worldY)` and `objectsInRect(rect)` to the LayoutEngine interface. Engines implement these using their native hit-test APIs (Fabric's `findTarget`, Konva's `getIntersection`/`find`).

**Rationale**: The gesture recognizer needs to know what's under the pointer to decide between drag, select, and rubber-band. Both engines already have internal hit-test capabilities — we just need to expose them through the interface. The alternative (the gesture recognizer tracking shape positions itself) would duplicate the spatial index each engine already maintains.

**Alternatives considered**:
- Maintaining a separate spatial index in the gesture recognizer: Rejected — duplicates engine state, risks stale data.
- Having engines emit "pointer-over" events: Rejected — adds latency and coupling.

## R3: Pan Suppression Strategy

**Decision**: The gesture recognizer tells the engine to suppress internal dragging during pan via a `setDragEnabled(enabled: boolean)` method on the interface.

**Rationale**: Both engines currently have hacks for this. Fabric toggles `canvas.selection`, Konva toggles `draggable()` on every node (expensive and fragile). A single interface method lets each engine implement suppression natively: Fabric disables `canvas.selection`, Konva can set a flag that its dragstart handlers check.

**Alternatives considered**:
- Gesture recognizer calling `stopPropagation()` to block engine events: Rejected — Fabric listens on its own canvas object, not the container's DOM events, so stopPropagation from the container wouldn't reach Fabric.
- Always intercepting all pointer events in the gesture recognizer and forwarding selectively: Rejected — too invasive, breaks engine-internal interaction (transformer handles, etc.).

## R4: Drag Ownership (Who Moves Shapes?)

**Decision**: Engines continue to own shape/group movement via their native drag systems. The gesture recognizer does NOT compute positions — it signals gesture boundaries (dragStart, dragMove, dragEnd) and the engines handle the actual movement.

**Rationale**: Both engines have sophisticated drag handling integrated with their renderers (Fabric's ActiveSelection, Konva's Transformer). Extracting position computation to the gesture recognizer would fight the engines instead of leveraging them. The key insight: we're extracting _gesture detection_, not _movement execution_.

What the gesture recognizer _does_ own:
- Disambiguation: "Is this a pan, drag, or rubber-band?"
- Lifecycle: "Drag started / ended" (for snap/collision finalization)
- Modifier state: "Shift held during click" (for multi-select)

What engines continue to own:
- Actual shape/group position updates during drag
- Transformer handle interaction (resize/rotate)
- Native selection frame rendering

**Alternatives considered**:
- Full position control in gesture recognizer with engines as pure renderers: Rejected — would require re-implementing drag preview, transform handles, and ActiveSelection behavior. Massive scope increase for minimal benefit.

## R5: Rubber-Band Selection

**Decision**: Move rubber-band selection to the gesture recognizer, rendering the rect as a DOM overlay (same pattern as `DrawingToolLayer`). Use `objectsInRect()` to query intersecting shapes on release.

**Rationale**: Currently only Konva implements rubber-band selection. Extracting it to the gesture recognizer means both engines get it for free. The rect is purely visual (dashed overlay) and doesn't need engine rendering — a positioned div or SVG overlay works. The hit-test uses the new `objectsInRect()` interface method.

**Alternatives considered**:
- Having each engine implement rubber-band with its own drawing primitives: Rejected — this is exactly the duplication we're eliminating.
- Using a canvas overlay: Rejected — an SVG or DOM overlay is simpler and engine-independent.

## R6: Shared Business Logic Extraction

**Decision**: Extract snap-to-grid, edge-anchor resize, and resize dimension quantization into pure functions in a new `input-math.ts` module. Collision detection stays in `collision.ts` (already shared).

**Rationale**: Both engines implement identical math:
- `snapToGrid(lowerLeftX, lowerLeftY, gridSize) → {x, y}` — same formula
- `computeEdgeAnchor(originalBounds, currentScale, gridSize) → {anchoredX, anchoredY, newW, newH}` — same algorithm in both engines (~40 lines each)
- `quantizeResize(width, height, gridSize) → {w, h}` — trivial but duplicated

These are pure coordinate transforms with no engine dependency.

**Alternatives considered**:
- Leaving snap in each GroupRenderer: Rejected — the formula is identical, only the "apply position" step differs.
- Putting all math in the gesture recognizer class: Rejected — pure functions are more testable and reusable.

## R7: Multi-Select Drag Snap

**Decision**: Keep the existing engine-specific strategies. Fabric snaps live via ActiveSelection. Konva defers snap to dragEnd. The gesture recognizer does NOT try to unify this.

**Rationale**: This is where the engine difference is fundamental. Fabric's ActiveSelection moves all objects as one unit, making live snap trivial. Konva's Transformer fires per-node dragmove events, causing drift if snap is applied per-frame. The engines already handle this correctly — forcing a unified approach would regress one of them.

The gesture recognizer's role is limited to signaling "multi-drag started/ended" so the Konva adapter knows to skip live snap.

## R8: Event Contract Post-Refactor

**Decision**: All existing EngineEventMap events continue to be emitted by the engines, not by the gesture recognizer. The gesture recognizer has its own event surface (gesture-level signals) that the engine integration layer consumes.

**Rationale**: Downstream consumers (undo/redo, project sync, bin artwork) already subscribe to engine events. Changing the event source would break all of them. The gesture recognizer is an _input to_ the engines, not a replacement for their event system.
