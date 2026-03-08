# Quickstart: Layout Engine Abstraction

**Date**: 2026-03-07
**Feature**: 009-layout-engine-abstraction

## Integration Scenarios

### Scenario 1: Mount an Engine and Add Shapes

```
1. App renders a <div> container for the layout canvas
2. useLayoutEngine() hook creates engine instance (Fabric or Konva based on preference)
3. Engine mounts into the container div
4. App calls engine.addShape({ id: '1', type: 'rect', x: 84, y: 84, width: 168, height: 168, ... })
5. Shape appears on canvas, snapped to grid
6. App calls engine.addShape({ id: '2', type: 'circle', x: 210, y: 210, radius: 42, ... })
7. Both shapes are visible and interactive
```

### Scenario 2: User Selects a Shape → Sidebar Updates

```
1. User clicks a shape on the canvas
2. Engine emits selectionChanged event with { ids: ['shape-1'] }
3. useEngineState() hook receives the event via useSyncExternalStore
4. Sidebar component re-renders, showing shape-1's properties (position, size, fill, stroke)
5. User modifies a property in the sidebar (e.g., changes fill color)
6. Sidebar calls engine.updateShape('shape-1', { fill: '#ff0000' })
7. Shape updates on canvas immediately
```

### Scenario 3: Group Shapes into a Bin

```
1. App calls engine.createGroup({ id: 'bin-1', x: 84, y: 84, width: 168, height: 168, childIds: ['pocket-1', 'pocket-2'], ... })
2. Pocket shapes become children of bin-1
3. User drags bin-1 → pockets move with it
4. Engine emits shapeMoved for the group
5. User clicks a pocket inside the bin → engine emits selectionChanged with the pocket's ID
```

### Scenario 4: Switch Engine at Runtime

```
1. User opens Preferences → Layout Engine → selects "Konva" (was "Fabric")
2. App captures: snapshot = engine.toSnapshot(), transient = engine.getTransientState()
3. App calls engine.dispose()
4. App creates new KonvaEngine, mounts it
5. App calls newEngine.loadSnapshot(snapshot)
6. App calls newEngine.setTransientState(transient)
7. Canvas re-renders with all shapes preserved, same viewport position, same selection
```

### Scenario 5: Save and Load Project

```
1. User clicks Save → app calls engine.toSnapshot()
2. Snapshot is merged into the project schema (.gfstudio JSON)
3. Project file is written to disk via existing IPC
4. User opens the project on another machine (or with a different default engine)
5. App reads project file, extracts layout snapshot
6. App calls engine.loadSnapshot(snapshot)
7. All shapes and groups render correctly regardless of engine
```

### Scenario 6: Resize and Snap

```
1. User selects a rect shape
2. Transform handles appear (resize corners/edges + rotation)
3. User drags a corner handle
4. Engine snaps resize to grid pitch (42px increments)
5. On release, engine normalizes dimensions (resets scale, updates width/height)
6. Engine emits shapeResized event with final dimensions
7. Sidebar updates to show new size
```

## Smoke Test Checklist

After integration, verify these flows manually:

- [ ] Create project → canvas renders with grid
- [ ] Place rect → appears at snapped position
- [ ] Place circle → appears, selectable
- [ ] Place polygon → appears, selectable
- [ ] Click shape → sidebar shows properties
- [ ] Drag shape → snaps to grid, sidebar updates position
- [ ] Resize shape → snaps to grid, sidebar updates dimensions
- [ ] Shift-click multi-select → transform handles wrap all selected
- [ ] Rubber-band select → multiple shapes selected
- [ ] Group shapes → move together
- [ ] Ungroup → shapes return to independent objects at correct positions
- [ ] Switch engine (Fabric ↔ Konva) → all state preserved
- [ ] Save project → reload → all shapes intact
- [ ] Pan (alt+drag) → canvas pans
- [ ] Zoom (scroll wheel) → zooms toward cursor
- [ ] Delete selected → shape removed, sidebar clears
