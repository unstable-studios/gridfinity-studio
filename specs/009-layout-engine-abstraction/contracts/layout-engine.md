# Contract: LayoutEngine Interface

**Date**: 2026-03-07
**Feature**: 009-layout-engine-abstraction

## Overview

The `LayoutEngine` interface is the single contract that both rendering adapters (Fabric.js, Konva) must satisfy. The host application (Viewport, Sidebar, Navbar) interacts exclusively with this interface. No rendering-library types cross this boundary.

## Interface Methods

### Lifecycle

| Method | Signature | Description |
|--------|-----------|-------------|
| mount | `(container: HTMLDivElement) => void` | Mount the engine into a DOM container. Creates internal canvas element(s). |
| dispose | `() => void` | Tear down the engine. Remove all event listeners, DOM elements, and internal state. Idempotent. |
| resize | `(width: number, height: number) => void` | Update canvas dimensions to match container. |

### Shape CRUD

| Method | Signature | Description |
|--------|-----------|-------------|
| addShape | `(shape: LayoutShape) => void` | Add a shape to the canvas. If `shape.groupId` is set, add as child of that group. |
| updateShape | `(id: string, patch: Partial<LayoutShape>) => void` | Update one or more properties of an existing shape. |
| removeShape | `(id: string) => void` | Remove a shape from the canvas (and from its parent group if grouped). |
| getShape | `(id: string) => LayoutShape \| undefined` | Read current state of a shape by ID. |
| getAllShapes | `() => LayoutShape[]` | Read current state of all shapes. |

### Group Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| createGroup | `(group: LayoutGroup) => void` | Create a group on the canvas with the given children. |
| updateGroup | `(id: string, patch: Partial<LayoutGroup>) => void` | Update group properties (position, size, style). |
| removeGroup | `(id: string) => void` | Remove a group. Children become top-level shapes at their world-space positions. |
| addToGroup | `(shapeId: string, groupId: string) => void` | Move a shape into a group, computing local coordinates. |
| removeFromGroup | `(shapeId: string) => void` | Remove a shape from its group, converting to world-space coordinates. |
| getGroup | `(id: string) => LayoutGroup \| undefined` | Read current state of a group by ID. |
| getAllGroups | `() => LayoutGroup[]` | Read current state of all groups. |

### Selection

| Method | Signature | Description |
|--------|-----------|-------------|
| select | `(ids: string[]) => void` | Set selection to the given IDs (shapes and/or groups). Clears previous selection. |
| addToSelection | `(ids: string[]) => void` | Add IDs to current selection (for shift-click). |
| clearSelection | `() => void` | Deselect all. |
| getSelectedIds | `() => string[]` | Return currently selected IDs. |

### Viewport

| Method | Signature | Description |
|--------|-----------|-------------|
| panTo | `(x: number, y: number) => void` | Set viewport pan position. |
| zoomTo | `(level: number, center?: { x: number; y: number }) => void` | Set zoom level, optionally centered on a point. |
| resetView | `() => void` | Reset pan to (0,0) and zoom to 1.0. |
| getViewport | `() => ViewportState` | Return current pan/zoom state. |

### Grid

| Method | Signature | Description |
|--------|-----------|-------------|
| setGridConfig | `(config: Partial<GridConfig>) => void` | Update grid snapping/visibility settings. |
| getGridConfig | `() => GridConfig` | Return current grid configuration. |

### Events

| Method | Signature | Description |
|--------|-----------|-------------|
| on | `<K extends keyof EngineEventMap>(event: K, handler: (payload: EngineEventMap[K]) => void) => () => void` | Subscribe to an engine event. Returns an unsubscribe function. |

### Serialization

| Method | Signature | Description |
|--------|-----------|-------------|
| toSnapshot | `() => LayoutSnapshot` | Export current canvas state as an engine-agnostic snapshot. |
| loadSnapshot | `(snapshot: LayoutSnapshot) => void` | Import a snapshot, replacing all current canvas state. |

### Transient State (for engine switching)

| Method | Signature | Description |
|--------|-----------|-------------|
| getTransientState | `() => TransientState` | Capture selection and viewport state. |
| setTransientState | `(state: TransientState) => void` | Restore selection and viewport state. |

### Capabilities

| Method | Signature | Description |
|--------|-----------|-------------|
| capabilities | `() => Set<string>` | Return the set of shape types and features this engine supports. |

### Interaction State

| Method | Signature | Description |
|--------|-----------|-------------|
| isInteracting | `() => boolean` | Whether a user interaction (drag, resize) is in progress. Used to block engine switching. |

## Event Map

```typescript
interface EngineEventMap {
  selectionChanged: { ids: string[] }
  shapeMoved: { id: string; x: number; y: number }
  shapeResized: { id: string; width?: number; height?: number; radius?: number }
  shapeCreated: { shape: LayoutShape }
  shapeDeleted: { id: string }
  groupChanged: { groupId: string; childIds: string[] }
  viewportChanged: { panX: number; panY: number; zoom: number }
}
```

## Contract Test Requirements

Both adapters MUST pass the following contract tests:

### Shape CRUD
- C1: `addShape(rect)` → `getShape(id)` returns the shape with correct properties.
- C2: `addShape(circle)` + `addShape(polygon)` → `getAllShapes()` returns both.
- C3: `updateShape(id, { x: 100 })` → `getShape(id).x === 100`.
- C4: `removeShape(id)` → `getShape(id)` returns undefined.

### Group Operations
- C5: `createGroup` with childIds → children's `groupId` is set.
- C6: `removeGroup(id)` → children become top-level with correct world-space positions.
- C7: `addToGroup(shapeId, groupId)` → shape appears in group's children.
- C8: `removeFromGroup(shapeId)` → shape becomes top-level.

### Selection
- C9: `select([id1, id2])` → `getSelectedIds()` returns `[id1, id2]`.
- C10: `clearSelection()` → `getSelectedIds()` returns `[]`.
- C11: Selection change emits `selectionChanged` event with correct IDs.

### Viewport
- C12: `panTo(50, 50)` → `getViewport()` returns `{ panX: 50, panY: 50, zoom: 1 }`.
- C13: `zoomTo(2)` → `getViewport().zoom === 2`.
- C14: `resetView()` → viewport returns to `{ panX: 0, panY: 0, zoom: 1 }`.

### Serialization Roundtrip
- C15: Add shapes + groups → `toSnapshot()` → `loadSnapshot()` → `getAllShapes()` and `getAllGroups()` match original.
- C16: Snapshot does not contain engine-specific properties.

### Events
- C17: `addShape()` emits `shapeCreated`.
- C18: `removeShape()` emits `shapeDeleted`.
- C19: `on()` returns an unsubscribe function that stops delivery.

### Lifecycle
- C20: `dispose()` is idempotent — calling twice does not throw.
- C21: After `dispose()`, no events are emitted.
