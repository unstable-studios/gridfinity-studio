# GroupRenderer Encapsulation

**Parent**: 010-layout-engine-integration
**Issue**: #235 (bin detail artwork)
**Status**: Design

## Problem

The `LayoutEngine` interface exposes group operations (`createGroup`, `updateGroup`,
`setGroupDecorations`) that each engine implements by directly orchestrating multiple
library-specific objects: a background rect, decoration circles/rects, child shapes,
and selection state. This creates several problems:

1. **Layout system interference** (Fabric): `group.add()` triggers `enterGroup()` +
   `FitContentLayout`, which transforms coordinates and resizes the group. Decorations
   must be spliced out of `_objects` before `triggerLayout()` and re-added after.

2. **Transformer staleness** (Konva): when group children change size, the Transformer
   caches stale bounds. Each callsite must know to refresh it.

3. **Coordinate conversion scattered**: the lower-left → centroid conversion happens in
   `createGroup`, `updateGroup`, `getGroup`, `setGroupDecorations`, and snap handlers.
   A mistake in any one produces misalignment.

4. **No encapsulation boundary**: the engine knows about `__groupBg`, `__binArtwork`,
   `_objects`, `triggerLayout`, `originX: 'center'` — all library internals that leak
   through the abstraction.

## Solution

Extract a **`GroupRenderer`** interface — one implementation per engine — that owns the
full visual representation of a group. The engine delegates to it; it handles all
library-specific internals.

```
LayoutEngine (fabric-engine.ts / konva-engine.ts)
  │
  ├── shapeMap, fabricMap/konvaMap   (shapes — unchanged)
  │
  └── groupRendererMap: Map<string, GroupRenderer>
        │
        └── GroupRenderer  (one per group)
              ├── background rect
              ├── decoration objects
              ├── child shape references
              ├── coordinate conversion (lower-left ↔ centroid)
              └── library-specific rendering
```

### GroupRenderer Interface

```typescript
/**
 * Encapsulates the visual representation of a LayoutGroup in a specific
 * canvas library. Handles coordinate conversion, background rect, decorations,
 * and child management internally.
 *
 * Coordinates at the boundary are always lower-left corner (LayoutGroup convention).
 * The renderer converts to library-native coords internally.
 */
interface GroupRenderer {
  /** Create the native group object and add it to the canvas/layer */
  create(group: LayoutGroup, canvas: NativeCanvas): void

  /** Update position, size, style, rotation */
  update(patch: Partial<LayoutGroup>): void

  /** Replace decorations (non-interactive artwork) */
  setDecorations(decorations: GroupDecoration[]): void

  /** Read back current position/size in lower-left convention */
  getGroupData(): LayoutGroup

  /** Add a child shape's native object to this group */
  addChild(shapeId: string, nativeObj: NativeShape): void

  /** Remove a child shape from this group, return it for re-parenting */
  removeChild(shapeId: string, nativeObj: NativeShape): void

  /** Get the native object for selection/canvas operations */
  getNativeNode(): NativeNode

  /** Notify the renderer that selection state changed (for transformer refresh) */
  refreshSelection(transformer: NativeTransformer | null): void

  /** Remove from canvas and clean up */
  destroy(): void
}
```

### FabricGroupRenderer

Handles internally:
- `originX: 'center'` / `originY: 'center'` group positioning
- `__groupBg` rect as first child
- `_objects` manipulation for decorations (bypassing `enterGroup` + layout)
- Splicing decorations before `triggerLayout()`, re-adding after
- `objectCaching: false` on the group
- `setCoords()` after position changes
- Centroid ↔ lower-left conversion

### KonvaGroupRenderer

Handles internally:
- Konva.Group positioned at centroid
- `.__groupBg` Konva.Rect
- `.__binArtwork` decoration nodes
- Transformer node refresh after decoration changes
- `dragmove`/`dragend` grid snap (lower-left based)
- Centroid ↔ lower-left conversion

## Impact on LayoutEngine Interface

This refactor adds public `LayoutEngine` methods (`setGroupDecorations`,
`setViewportInsets`) and re-exports the associated types, but does not change the
behavior or signatures of existing methods. The `GroupRenderer` itself remains an
internal implementation detail of each engine adapter: the engine's `createGroup`,
`updateGroup`, `setGroupDecorations`, `removeGroup`, and `getGroup` methods simply
delegate to the renderer.

## Impact on Existing Tests

**No changes to test assertions.** The decoration contract tests and engine contract
tests validate behavior through the `LayoutEngine` interface. The `GroupRenderer`
refactor is purely internal — tests continue to pass without modification.

## Tasks

### T015a: Define GroupRenderer interface
- Create `src/renderer/src/layout-engine/group-renderer.ts`
- Define the interface with JSDoc documenting coordinate conventions
- Export from `index.ts`

### T015b: Implement FabricGroupRenderer
- Extract all Fabric group logic from `fabric-engine.ts` into `FabricGroupRenderer`
- Move: group creation, bgRect management, decoration `_objects` manipulation,
  triggerLayout dance, coordinate conversion, snap handling
- `FabricEngine.createGroup()` becomes: create renderer, store in map, delegate

### T015c: Implement KonvaGroupRenderer
- Extract all Konva group logic from `konva-engine.ts` into `KonvaGroupRenderer`
- Move: Konva.Group creation, bgRect, decoration nodes, transformer refresh,
  dragmove/dragend snap, coordinate conversion

### T015d: Simplify engine group methods
- `createGroup`, `updateGroup`, `removeGroup`, `setGroupDecorations`, `getGroup`,
  `getAllGroups` in both engines become thin delegators to `GroupRenderer`
- Remove duplicated coordinate conversion from engine-level code

### T015e: Verify contract tests pass
- All 19 decoration contract tests pass without changes
- All existing engine contract tests pass without changes
- Lint + typecheck clean

## Sequencing in 010 Plan

This refactor is a **sub-task of T015** (bin detail artwork). It replaces the current
hacky `_objects` manipulation with a clean encapsulation. The updated Phase 2 sequence:

```
T015a → T015b → T015c → T015d → T015e (GroupRenderer refactor)
  → T018 (drag-to-resize — benefits from GroupRenderer)
  → T019 (collision detection)
  → T020 (smoke test)
```

The `GroupRenderer` also simplifies future work:
- **T018 (drag-to-resize)**: resize handles are part of the renderer, not engine-level code
- **T019 (collision)**: renderer exposes bounds in consistent coords
- **T036 (shape-to-bin assignment)**: `addChild`/`removeChild` are clean operations
