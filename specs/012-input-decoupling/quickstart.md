# Quickstart: Input Handling Decoupling

## What This Feature Does

Extracts gesture recognition (pan, zoom, select, rubber-band) from the Fabric and Konva engine adapters into a shared, engine-agnostic layer. Engine adapters become simpler — they implement a focused action-handler interface instead of duplicating input logic.

## Key Design Decisions

1. **Gesture recognizer at DOM capture level** — intercepts events before engines see them
2. **Engines keep drag/resize execution** — recognizer handles gesture detection, engines handle movement
3. **New interface methods**: `objectAt()`, `objectsInRect()`, `setDragEnabled()`, `screenToWorld()`
4. **Shared math module** (`input-math.ts`): snap-to-grid, edge-anchor, resize quantization
5. **Rubber-band selection via DOM overlay** — engine-independent, both engines get it

## Architecture

```
Container (div)
  │
  ├── GestureRecognizer (capture-phase DOM listeners)
  │     Produces: pan/zoom/select/rubber-band commands
  │     Queries: engine.objectAt(), engine.objectsInRect()
  │
  └── LayoutEngine adapter (Fabric or Konva)
        Implements: InputActionHandler
        Owns: native drag/resize, transform handles, selection rendering
        Emits: EngineEventMap (unchanged)
```

## File Structure

```
src/renderer/src/layout-engine/
├── gesture-recognizer.ts      # NEW: GestureRecognizer class
├── input-action-handler.ts    # NEW: Interface + types
├── input-math.ts              # NEW: Shared snap/resize/anchor math
├── fabric-engine.ts           # MODIFIED: implement InputActionHandler, remove input code
├── konva-engine.ts            # MODIFIED: implement InputActionHandler, remove input code
├── fabric-group-renderer.ts   # MODIFIED: remove snap math (use input-math)
├── konva-group-renderer.ts    # MODIFIED: remove snap/resize math (use input-math)
├── LayoutEngineContext.tsx     # MODIFIED: create/manage GestureRecognizer lifecycle
└── interface.ts               # MODIFIED: add objectAt, objectsInRect, setDragEnabled, screenToWorld
```

## What Changes for Downstream Consumers

**Nothing.** All existing engine events (`shapeMoved`, `groupMoved`, `selectionChanged`, `viewportChanged`, etc.) continue to be emitted by the engines with the same payloads. Hooks like `useEngineUndoRedo`, `useProjectEngineSync`, and `useBinArtwork` require no changes.

## Build & Verify

```bash
pnpm typecheck    # Must pass — no new type errors
pnpm lint         # Must pass — no new warnings
pnpm dev          # Smoke test: pan, zoom, select, drag, resize, undo/redo
```

## Risk Areas

- **Pan during drag**: Gesture recognizer must correctly suppress engine dragging during pan. Regression: shapes move when you meant to pan.
- **Multi-select drag snap**: Konva's per-node dragmove still defers snap to dragend. Ensure the recognizer doesn't interfere with this.
- **Transformer handles**: Engine resize handles (Konva Transformer, Fabric scaling controls) must remain functional — the recognizer must not steal their pointer events.
