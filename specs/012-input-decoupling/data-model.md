# Data Model: Input Handling Decoupling

## Entities

### GestureRecognizer

Stateful input processor that owns DOM event listeners on the engine container.

**State**:
- `mode`: Current gesture mode — `idle | panning | dragging | rubberBand`
- `pointerStart`: World-space coordinates where the current gesture began
- `lastPointer`: Screen-space coordinates of the most recent pointer event
- `modifiers`: Current modifier key state — `{ alt, shift, ctrl, meta }`
- `target`: Result of `objectAt()` from gesture start — `{ type, id } | null`

**Lifecycle**:
- Created when an engine mounts
- Attaches DOM listeners to the container div (capture phase)
- Detaches on engine dispose or unmount
- Resets to `idle` on any engine switch

### GestureEvent (discriminated union)

Semantic events produced by the GestureRecognizer and consumed by the engine's action handler.

| Variant | Fields | When emitted |
| ------- | ------ | ------------ |
| `panStart` | `screenX, screenY` | Alt-down + primary press, or middle-click |
| `panMove` | `dx, dy` (screen-space delta) | Pointer move during pan |
| `panEnd` | — | Button release during pan |
| `zoom` | `delta, centerX, centerY` (screen-space) | Scroll wheel |
| `clickSelect` | `worldX, worldY, targetId, shift` | Primary click on shape/group (no drag) |
| `clearSelect` | — | Primary click on empty canvas (no shift) |
| `rubberBandStart` | `worldX, worldY` | Primary press on empty canvas |
| `rubberBandMove` | `rect: {x, y, width, height}` (world-space) | Pointer move during rubber-band |
| `rubberBandEnd` | `rect: {x, y, width, height}` (world-space) | Button release during rubber-band |
| `dragReady` | `targetId` | Primary press on a shape/group (pre-disambiguation) |
| `dragCancel` | — | Pointer released without meeting drag threshold |

### InputActionHandler (interface)

Implemented by each engine adapter. Translates gesture events into native engine operations.

| Method | Purpose |
| ------ | ------- |
| `applyPan(dx, dy)` | Translate the viewport by screen-space delta |
| `applyZoom(delta, centerX, centerY)` | Scale the viewport around the given screen point |
| `setDragEnabled(enabled)` | Suppress/restore native shape dragging |
| `objectAt(worldX, worldY)` | Hit-test: return the top-most shape/group at the point |
| `objectsInRect(rect)` | Region query: return all shapes/groups intersecting the rect |
| `selectIds(ids)` | Set the current selection to the given IDs |
| `addToSelection(ids)` | Add IDs to the current selection |
| `clearSelection()` | Deselect all |
| `showRubberBand(rect)` | Display the selection rectangle overlay |
| `hideRubberBand()` | Remove the selection rectangle overlay |

### Shared Pure Functions (input-math.ts)

| Function | Signature | Purpose |
| -------- | --------- | ------- |
| `snapLowerLeft` | `(x, y, gridSize) → {x, y}` | Snap a lower-left corner to the nearest grid intersection |
| `quantizeResize` | `(w, h, gridSize) → {w, h}` | Round dimensions to grid-aligned values (min 1 unit) |
| `computeEdgeAnchor` | `(originalBounds, scaledBounds, gridSize) → {x, y, w, h}` | Detect which edges are stationary and compute anchored position + grid-snapped size |

## Relationships

```
Container (DOM div)
    │
    ├── GestureRecognizer (capture-phase listeners)
    │     │
    │     ├── produces → GestureEvent (discriminated union)
    │     └── queries → engine.objectAt() / engine.objectsInRect()
    │
    └── LayoutEngine (Fabric or Konva adapter)
          │
          ├── implements → InputActionHandler
          ├── owns → native canvas + shape rendering
          ├── owns → drag/resize execution (Transformer, ActiveSelection)
          └── emits → EngineEventMap (unchanged downstream contract)
```

## State Transitions

```
idle
  ├── Alt/middle-click on anything → panning
  ├── Primary click on empty canvas (no drag) → clearSelect → idle
  ├── Primary press on shape/group → dragReady
  │     ├── Pointer moves past threshold → engine handles native drag → idle on release
  │     └── Pointer released without threshold → clickSelect → idle
  └── Primary press on empty canvas + drag → rubberBand
        └── Release → selectIds(hits) → idle

panning
  └── Button release / Alt release / blur → panEnd → idle

rubberBand
  ├── Alt pressed mid-drag → cancel rubberBand → panning
  └── Button release → query objectsInRect → selectIds → idle
```
