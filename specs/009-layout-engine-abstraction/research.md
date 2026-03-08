# Research: Layout Engine Abstraction

**Date**: 2026-03-07
**Feature**: 009-layout-engine-abstraction

## R1: Interface Design — Class vs Interface vs Abstract Class

**Decision**: Use a TypeScript `interface` for the `LayoutEngine` contract.

**Rationale**: A plain interface is idiomatic TypeScript, compiles away entirely (zero runtime), and imposes no inheritance constraints. Fabric and Konva adapters share almost no internal implementation, so an abstract class with shared logic is unwarranted. If shared helpers emerge later, extract into utility functions.

**Alternatives considered**:
- Abstract class — locks into single inheritance, couples adapters to a base. Only justified if adapters share 50+ lines (they don't).
- Concrete class with strategy pattern — over-engineered for two adapters.

**Prior art**: Two.js uses an imperative interface with pluggable renderers (SVG, Canvas, WebGL). PixiJS v8 uses an `AbstractRenderer` base class but that's justified by substantial shared pipeline code. tldraw separates store (canonical) from rendering (projection).

---

## R2: Typed Events — Emitter Pattern

**Decision**: Use `mitt` (200-byte functional emitter) with a TypeScript event map type. Subscribe returns an unsubscribe function.

**Rationale**: Lightweight, type-safe, aligns with React's `useEffect` cleanup pattern and `useSyncExternalStore`'s `subscribe` signature. RxJS is overkill (handful of discrete events, not continuous streams). Node's `EventEmitter` is stringly-typed and unnecessary in a browser context.

**Alternatives considered**:
- RxJS — powerful but heavy dependency, steep learning curve, second reactive system alongside React.
- Node EventEmitter — stringly-typed, requires wrapper for type safety.
- Custom typed emitter — viable but `mitt` already does this at 200 bytes.

---

## R3: React Integration — useSyncExternalStore

**Decision**: Use `useSyncExternalStore` to bridge engine events → React re-renders. Engine instance held in a ref, exposed via React Context.

**Rationale**: `useSyncExternalStore` (React 18+) is purpose-built for subscribing React to external mutable stores with tear-free concurrent reads. The engine exposes `subscribe(callback): () => void` and `getSnapshot(): EngineSnapshot`. Snapshot is a lightweight immutable value (selection IDs, viewport rect, version counter — not full shape data).

**Pattern**:
- `LayoutEngineProvider` context holds engine ref
- `useLayoutEngine()` returns the engine instance for imperative calls
- `useEngineState()` calls `useSyncExternalStore` for reactive reads (sidebar, toolbar)

**Alternatives considered**:
- Zustand as intermediary — adds a layer when engine already has events. Unnecessary.
- Manual `useState` + `useEffect` subscriptions — works but `useSyncExternalStore` handles concurrent mode correctly.

---

## R4: Imperative vs Declarative Adapters

**Decision**: Both adapters use their library's imperative API. The Konva adapter uses raw Konva, NOT react-konva.

**Rationale**: The adapter interface is imperative (`mount`, `dispose`, `addShape`, `removeShape`). If we let react-konva own rendering, we can't abstract it behind the same interface as Fabric without leaking React component trees into the engine contract. Raw Konva is a perfectly capable imperative API — react-konva is a convenience wrapper. Using raw Konva keeps both adapters at the same abstraction level.

**Trade-offs**:
- Losing react-konva means losing declarative niceties (automatic reconciliation, JSX). But we gain a clean, testable, uniform interface.
- Both adapters own a `<canvas>` or `<div>` that they imperatively manage — React just mounts/unmounts the container.

**Validation**: Two.js proves this pattern works. One imperative API, multiple rendering backends, user never sees renderer internals.

---

## R5: Fabric.js v7 Key Findings

### React lifecycle
- Create canvas in `useEffect`, dispose in cleanup. `dispose()` is async in v7 — need a guard ref for React 19 strict mode double-mount.
- Sync via Fabric events: `selection:created`, `selection:updated`, `selection:cleared`, `object:modified`, `object:moving`, `object:scaling`.
- Container resize via `ResizeObserver` → `canvas.setDimensions()`.

### Groups
- `new fabric.Group([...children], { subTargetCheck: true, interactive: true })` enables clicking individual children.
- `group.ungroupOnCanvas()` recalculates world-space coordinates. v6 rewrite fixed historical coordinate bugs.
- Dragging between groups is NOT built-in — requires manual remove/transform/add.
- `triggerLayout()` must be called after programmatic child add/remove.

### Serialization
- `canvas.toJSON()` outputs `{ version, objects: [...], background }`. Groups serialize recursively.
- `canvas.loadFromJSON(json)` restores state (async in v7).
- Custom properties via `FabricObject.customProperties = ['id', 'layoutType']`.
- For engine-agnostic persistence: map Fabric JSON → our domain model on save, reconstruct on load.

### Snap during resize
- Event-based: `object:scaling` fires continuously. Normalize `width * scaleX`, round to grid, reset scaleX to 1.
- Aspect ratio: `lockUniScaling: true` or `uniformScaling` canvas option.

### SVG paths
- `fabric.Path` is fully interactive (select, move, resize, group). First-class citizen.
- `loadSVGFromString()` is Promise-based in v7. Complex SVGs become Groups automatically.

### Performance
- 200-500 objects is well within comfortable range with object caching (enabled by default).
- Object caching pre-renders to offscreen canvas; subsequent draws blit the bitmap.
- Optimization levers: `renderOnAddRemove: false` for batch operations, `noScaleCache: true` during zoom.

### Key gotchas
- v7 changes `originX`/`originY` default to `'center'` (was `'left'`/`'top'`). Must set explicitly.
- v7 renames event properties: `pointer`/`absolutePointer` → `viewportPoint`/`scenePoint`.
- `dispose()` is async — guard against React strict mode double-mount.

---

## R6: Konva Key Findings

### Imperative API
- Raw Konva works well: `new Konva.Stage({ container })`, `layer.add(shape)`, `shape.setAttrs()`, etc.
- `stage.toJSON()` and `Konva.Node.create(json)` for native serialization (not used for our persistence).
- Each `Layer` is a separate `<canvas>` element — only dirty layers redraw.

### Groups
- `new Konva.Group({ ... })` with `group.add(child)`. Children positioned relative to group.
- Clicking children: events bubble child → group → layer → stage. Children receive their own events.
- `node.moveTo(newGroup)` does NOT auto-recalculate world position — must manually use `getAbsoluteTransform().invert()` to compute new local coordinates.
- No built-in "ungroup" — same manual process.

### Selection & Transformer
- `Konva.Transformer` with `transformer.nodes([...])` for multi-select.
- Marquee selection NOT built-in — ~30 lines custom (same as our sandbox).
- Programmatic selection: just call `transformer.nodes(resolvedNodes)`.
- Transformer modifies `scaleX`/`scaleY`, not `width`/`height`. Must normalize on `transformend`.

### Snap during resize
- `anchorDragBoundFunc(oldPos, newPos)` for grid snapping during resize.
- `boundBoxFunc(oldBox, newBox)` for min/max size constraints.
- Both fire on every pointer move — keep lightweight.

### SVG paths
- `Konva.Path` with SVG data string is fully interactive (select, drag, resize via Transformer).
- Full SVG import requires manual parsing (DOMParser → extract elements → map to Konva shapes).

### Performance
- 200-500 nodes: comfortable. Layered rendering (separate canvas per Layer) prevents unnecessary redraws.
- `node.cache()` rasterizes complex nodes. Keep layers to 2-3 max.

### Key gotchas
- `moveTo()` between groups does NOT preserve world position — manual coordinate math required.
- No built-in ungroup or marquee selection.
- Each Layer = separate canvas = GPU memory.

---

## R7: Serialization Strategy

**Decision**: The `.gfstudio` project schema IS the canonical format. Adapters translate to/from it. No engine-specific data in project files.

**Rationale**: A superset approach (union of engine-specific properties) leaks engine details and grows unbounded. The domain model defines what shapes are; adapters project engine state to/from it.

**Pattern**:
- `toSnapshot(): LayoutSnapshot` — engine reads its internal state, produces domain-model shapes.
- `loadSnapshot(snapshot: LayoutSnapshot): void` — engine creates internal objects from domain shapes.
- Transient state (selection, viewport) captured separately for engine switching.

---

## R8: Runtime Engine Switching

**Decision**: Serialize → dispose → create → deserialize. Capture transient state (selection, viewport) separately.

**Rationale**: Simplest correct approach. Visual flash during switch is acceptable for a rare preference change.

**Pattern**:
1. `const snapshot = currentEngine.toSnapshot()`
2. `const transient = currentEngine.getTransientState()` (selectedIds, viewport pan/zoom)
3. `currentEngine.dispose()`
4. `const newEngine = createAdapter(newType, container)`
5. `newEngine.loadSnapshot(snapshot)`
6. `newEngine.setTransientState(transient)`

**Protection**: Disable engine switch UI while `engine.isInteracting()` is true. Cancel in-progress interactions before switching.

---

## R9: Testing Adapter Parity

**Decision**: Shared contract test suite parameterized over both adapters, plus property-based tests for serialization roundtrips.

**Rationale**: Define tests against the interface, run against both implementations. Vitest's `describe.each` or factory function. Property-based tests via `@fast-check/vitest` for serialization roundtrips.

**Contract tests cover**: addShape/removeShape, updateShape, selection (single/multi/none), viewport manipulation, serialization roundtrip, event emission, dispose cleanup.

**Visual parity**: Not tested automatically. Adapters produce equivalent logical state, not pixel-identical output.

---

## R10: Capabilities API

**Decision**: Add a `capabilities(): Set<Capability>` method to the engine interface.

**Rationale**: Shape types or features that one engine supports but the other doesn't should be discoverable at runtime. The UI can disable unsupported features or show warnings. For MVP, both engines support the same set (rect, circle, polygon, SVG path, mesh-import placeholder).
