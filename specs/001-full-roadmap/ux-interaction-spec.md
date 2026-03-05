# UX Interaction Specification

**Purpose**: Define the complete set of expected interaction patterns for Gridfinity Studio, derived from reference audits of Tinkercad and Onshape sketch mode. This document serves as acceptance criteria for all UI work and a checklist gate for phase completion.

**Reference apps**: Tinkercad (beginner-friendly 3D CAD), Onshape sketch mode (professional 2D sketch in browser CAD)

**Our position**: Gridfinity Studio is closer to Tinkercad in complexity (we're not building a parametric constraint solver) but closer to Onshape in interaction quality (our users are makers who expect real CAD behavior in 2D sketch mode).

---

## Part 1: CAD Interaction Heuristics

These are non-negotiable standards. Every feature must pass all applicable heuristics before being marked complete.

### H1. Visible Feedback
Every user action produces visible feedback within 100ms. Click → highlight. Drag → object moves. Tool select → cursor changes. No silent state changes.

### H2. Undo Everything
Every mutation is undoable. Entity creation, deletion, move, resize, rotate, property change, extrusion change — all single-step undo via Cmd+Z. The user should never fear experimenting.

### H3. Mode Visibility
The current tool/mode is always visible in the UI. Active tool is highlighted in the toolbar. Cursor reflects what will happen on click. The user should never wonder "what mode am I in?"

### H4. Cursor Communicates Intent
- **Select mode**: default arrow
- **Drawing tool active**: crosshair
- **Hovering draggable entity**: move cursor (grab hand or four-arrow)
- **Hovering resize handle**: directional resize arrow
- **Hovering rotate handle**: rotation cursor
- **Panning**: closed hand / grabbing
- **Over non-interactive area**: default arrow

### H5. Dimensions on Demand
Selected entities always show their dimensions (inline on canvas or in sidebar). During resize, live dimension labels update in real-time. Property panel values always reflect current state.

### H6. Snap Before Commit
Snap points are previewed before the user commits. Visual indicators (dots, lines, highlights) appear when the cursor is near a snap target. The user sees exactly where their action will land before clicking.

### H7. Contextual Actions
Right-click on an entity shows relevant actions (delete, duplicate, properties). Right-click on empty canvas shows relevant canvas actions. No right-click menus with all items disabled.

### H8. Escape Cancels
- First Escape: cancel in-progress operation (e.g., mid-draw shape)
- Second Escape: deactivate tool, return to select mode
- Consistent across all tools and modes

### H9. Destructive Actions Are Reversible
Delete is undoable. No confirmation dialogs for single-entity deletion (undo is faster than confirming). Only confirm for bulk operations or irreversible exports.

### H10. Direct Manipulation First
Users should be able to do everything by interacting directly with the canvas. The sidebar is the secondary editing path. Both work, but canvas interaction is primary.

### H11. Constraint Communication
Snapping, grid alignment, and any constraints are communicated visually — not just applied silently. Orange/green indicators, dashed guide lines, snap point markers.

### H12. No Dead Buttons
Every visible button, menu item, and control does something. If a feature isn't implemented yet, the control should not exist. Disabled states are acceptable only when context makes the reason obvious (e.g., "Export" disabled when no mesh is baked).

---

## Part 2: Verb × Noun Interaction Matrix

Every cell is either **Required** (must work for v1), **Planned** (in a later phase), or **Out of Scope** (explicitly excluded). Empty cells are gaps to investigate.

### Nouns (Entity Types)

| ID | Noun | Description |
|----|------|-------------|
| N1 | Circle | 2D circle entity |
| N2 | Rectangle | 2D rectangle entity |
| N3 | Polygon | 2D polygon (multi-vertex) |
| N4 | SVG Region | Imported SVG path |
| N5 | Mesh | Imported STL mesh |
| N6 | Group | Grouped entities |
| N7 | Bin | Gridfinity bin container |
| N8 | Pattern | Linear pattern of instances |

### Verbs (Actions)

| ID | Verb | Expected Interaction |
|----|------|---------------------|
| V1 | Create | Place a new instance on the canvas |
| V2 | Select | Click to select, highlight, show handles |
| V3 | Multi-select | Shift+click or marquee drag |
| V4 | Deselect | Click empty space or Escape |
| V5 | Move | Drag entity body or arrow keys |
| V6 | Resize | Drag corner/edge handles |
| V7 | Rotate | Drag rotation handle or type angle |
| V8 | Delete | Delete/Backspace key |
| V9 | Duplicate | Cmd+D (in place) or Alt+drag (copy-move) |
| V10 | Copy/Paste | Cmd+C / Cmd+V with offset |
| V11 | Edit Properties | Sidebar panel: name, dimensions, position, extrusion |
| V12 | Extrude | Set depth/direction/role in sidebar or inline |
| V13 | Constrain/Snap | Grid snap, entity snap during move/create |
| V14 | Undo/Redo | Cmd+Z / Cmd+Shift+Z for each verb above |
| V15 | Group/Ungroup | Cmd+G / Cmd+Shift+G |
| V16 | Align/Distribute | Toolbar actions when 2+ selected |
| V17 | Export | STL/3MF from baked result |

### Matrix

| | N1 Circle | N2 Rect | N3 Polygon | N4 SVG | N5 Mesh | N6 Group | N7 Bin | N8 Pattern |
|---|---|---|---|---|---|---|---|---|
| **V1 Create** | Required | Required | Required | Planned (US2) | Planned (US2) | Planned (US2) | Required | Planned (US2) |
| **V2 Select** | Required | Required | Required | Planned | Planned | Planned | Required | Planned |
| **V3 Multi-select** | Required | Required | Required | Planned | Planned | Planned | Out of Scope | Planned |
| **V4 Deselect** | Required | Required | Required | Required | Required | Required | Required | Required |
| **V5 Move** | Required | Required | Required | Planned | Planned | Planned | Out of Scope | Planned |
| **V6 Resize** | Required | Required | Planned | Planned | Out of Scope | Planned | Out of Scope | Out of Scope |
| **V7 Rotate** | Out of Scope | Required | Required | Planned | Planned | Planned | Out of Scope | Out of Scope |
| **V8 Delete** | Required | Required | Required | Planned | Planned | Planned | Required | Planned |
| **V9 Duplicate** | Required | Required | Required | Planned | Planned | Planned | Out of Scope | Out of Scope |
| **V10 Copy/Paste** | Planned | Planned | Planned | Planned | Planned | Planned | Out of Scope | Out of Scope |
| **V11 Edit Props** | Required | Required | Required | Planned | Planned | Planned | Required | Planned |
| **V12 Extrude** | Required | Required | Required | Planned | Out of Scope | Planned | N/A | Planned |
| **V13 Snap** | Required | Required | Required | Planned | Out of Scope | Planned | N/A | Out of Scope |
| **V14 Undo/Redo** | Required | Required | Required | Planned | Planned | Planned | Required | Planned |
| **V15 Group** | Planned | Planned | Planned | Planned | Planned | Planned | Out of Scope | Out of Scope |
| **V16 Align** | Planned | Planned | Planned | Planned | Planned | Planned | Out of Scope | Out of Scope |
| **V17 Export** | N/A | N/A | N/A | N/A | N/A | N/A | Required | N/A |

**Legend**:
- **Required**: Must work in Phase 3.5 (UX Foundations) or is already working from Phase 3
- **Planned**: Addressed in a specific later phase (US2/US3/US4)
- **Out of Scope**: Explicitly excluded from v1 — not a gap, a decision
- **N/A**: Not applicable (e.g., you don't "export" a circle directly)

---

## Part 3: Interaction Detail — Required Behaviors

These define exactly how each Required verb works, based on patterns from Tinkercad and Onshape.

### Create (V1)

| Shape | Creation Flow | Reference |
|-------|---------------|-----------|
| Circle | Click to place center, drag to set radius, release to commit | Onshape center-point circle |
| Rectangle | Click to place first corner, drag to opposite corner, release to commit | Onshape corner rectangle |
| Polygon | Click to place vertices sequentially; click near start vertex to close (snap indicator shows when in range) | Onshape polygon |

**Post-creation behavior**: After placing a shape, the tool stays active for placing another (Onshape pattern). Press Escape to return to select mode. The newly created entity is auto-selected.

**Dimension entry after creation**: After placing a circle, a radius/diameter input appears. After placing a rectangle, width and height inputs appear. User can type exact values immediately or accept the drag size.

### Select (V2)

- **Single click on entity**: Selects it, deselects everything else. Entity highlights (color change). Handles appear. Sidebar shows properties.
- **Click on empty space**: Deselects all.
- **Shift+click**: Toggle entity in/out of selection (additive select).
- **Marquee select**: Click-drag on empty space draws a selection rectangle.
  - Left-to-right drag: only fully enclosed entities are selected (Onshape "window" mode)
  - Right-to-left drag: enclosed + touched entities are selected (Onshape "crossing" mode)

### Move (V5)

- **Drag entity body**: Moves freely, snapping to grid if snap is enabled.
- **Arrow keys**: Move 1 grid unit per press.
- **Shift+drag**: Constrain to horizontal or vertical axis.
- **Visual feedback**: Entity follows cursor in real-time. Snap indicators appear when aligned with grid or other entities.

### Resize (V6)

- **Handles**: Corner handles (scale both dimensions proportionally with Shift held) and edge midpoint handles (scale one dimension).
- **Drag handle**: Live preview of new size. Dimension labels update in real-time.
- **Click handle without dragging**: Opens numeric input for that dimension.
- **Shift+drag corner**: Proportional/uniform resize.
- **Alt+drag**: Resize from center instead of opposite edge.
- **Circle**: Single handle for radius. Drag to resize, or click to type diameter.
- **Rectangle**: 4 edge handles + 4 corner handles. Edge handles resize one axis. Corner handles resize both.
- **Polygon**: Resize not required for v1 (vertex editing is complex). Planned for later.

### Rotate (V7)

- **Rotation handle**: Appears outside the entity bounding box as a curved arc or rotation knob.
- **Drag rotation handle**: Free rotation with angle display.
- **Shift+drag**: Snap to 15° or 45° increments.
- **Type angle**: Click rotation handle to open angle input.
- **Circle**: Rotation has no visual effect — no rotation handle shown.

### Delete (V8)

- **Delete/Backspace key**: Removes selected entities.
- **Single undo step**: Each delete is one Cmd+Z to restore.
- **No confirmation dialog**: Undo is the safety net.

### Duplicate (V9)

- **Cmd+D**: Duplicate selected entities in place (zero offset), new copies are selected.
- **Alt+drag**: Start dragging, hold Alt — creates a copy and moves the copy, original stays.
- **Repeat pattern**: Subsequent Cmd+D after a move repeats the last transform (Tinkercad pattern).

### Edit Properties (V11)

- **Sidebar panel**: Always shows properties of selected entity. Name, type, position (x, y), dimensions, extrusion config.
- **Controlled inputs**: All fields update the entity in real-time on every keystroke (no blur/enter required for the change to take effect).
- **Canvas inline editing**: Click a dimension label on the canvas to edit (future enhancement — sidebar-first for v1).

### Extrude (V12)

- **Sidebar controls**: Depth input, direction dropdown (up/down), role dropdown (solid/cutter).
- **"Add Extrusion" button**: Applies default extrusion (5mm, down, cutter).
- **Visual feedback**: Extruded entity shows differently in layout mode (filled vs outline, or color-coded by role). In review mode, the extrusion is visible as 3D geometry.
- **Remove extrusion**: Button or set depth to 0.

### Snap (V13)

- **Grid snap (default on)**: All movements and placements snap to the Gridfinity grid.
- **Visual indicators**: Grid intersection points highlight when cursor is nearby. Snap-to-entity indicators show when aligning with edges/centers of other entities.
- **Shift to suppress**: Hold Shift during drag to temporarily disable snapping for fine positioning.
- **Snap toggle**: Global on/off in toolbar or status bar.

---

## Part 4: Viewport Controls

Based on the "Google Maps / every CAD tool" standard that the user explicitly called out.

### Layout Mode (2D Orthographic)

| Input | Action | Notes |
|-------|--------|-------|
| Scroll wheel | Zoom (cursor-centered) | Smooth, ~5% per detent, normalized for trackpad |
| Right-click drag | Pan | Drag direction = viewport scroll direction (NOT camera movement) |
| Middle-click drag | Pan (alternative) | Same behavior as right-click drag |
| Left-click drag on entity | Move entity | Or start tool operation |
| Left-click drag on empty space | Marquee select | When in select mode |
| Cmd+0 or F | Zoom to fit | Fit all entities, or grid if no entities |
| Cmd+= / Cmd+- | Zoom in / out | Keyboard zoom |

**Pan direction rule**: Dragging right → viewport scrolls right (content moves right under your hand). This is the Google Maps convention. Internally: negate the mouse delta before applying to camera position.

### Review Mode (3D Perspective)

| Input | Action |
|-------|--------|
| Left-click drag | Orbit |
| Right-click drag | Pan |
| Scroll wheel | Zoom (dolly) |
| F | Zoom to fit baked mesh |

---

## Part 5: Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| Cmd+N | New project |
| Cmd+O | Open project |
| Cmd+S | Save |
| Cmd+Shift+S | Save As |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+, | Preferences |
| Delete / Backspace | Delete selected |
| Escape | Cancel tool / deselect |

### Layout Mode

| Shortcut | Action |
|----------|--------|
| V or 1 | Select tool |
| R or 2 | Rectangle tool |
| C or 3 | Circle tool |
| P or 4 | Polygon tool |
| Cmd+D | Duplicate |
| Cmd+A | Select all |
| Cmd+G | Group |
| Cmd+Shift+G | Ungroup |
| F | Zoom to fit |
| Shift (during drag) | Constrain to axis / suppress snap |
| Alt (during drag) | Duplicate-and-move |
| Arrow keys | Nudge 1 grid unit |

### Review Mode

| Shortcut | Action |
|----------|--------|
| F | Zoom to fit |
| Cmd+E | Export STL |

---

## Part 6: Checklist Gate

Run this checklist before marking any phase complete. Every item must pass.

### Interaction Quality

- [ ] Every clickable element has a hover state
- [ ] Every action produces visible feedback within 100ms
- [ ] Current tool/mode is visually indicated in toolbar
- [ ] Cursor changes appropriately for context (H4)
- [ ] Selected entities show handles and dimensions
- [ ] Escape works consistently (cancel → deselect → no-op)
- [ ] Right-click shows contextual options (not empty or all-disabled menus)
- [ ] Undo covers every mutation in the phase

### Canvas Behavior

- [ ] Pan direction matches user expectation (drag right = scroll right)
- [ ] Zoom is cursor-centered and sensitivity feels natural
- [ ] Zoom-to-fit frames content appropriately
- [ ] Grid is visible and scales with zoom level
- [ ] Snap indicators appear before committing

### Property Editing

- [ ] All entity properties are editable in sidebar
- [ ] Changes apply in real-time (no blur/enter gate)
- [ ] Canvas and sidebar stay in sync bidirectionally
- [ ] Typed values are validated (no NaN, no negative dimensions)

### Visual Consistency

- [ ] Design tokens from echo-libs are applied consistently
- [ ] No default browser styling leaking through
- [ ] Dark mode works correctly for all new UI
- [ ] No layout shifts when tools/panels appear or disappear
- [ ] Text truncates rather than wrapping where space is constrained

### Integration

- [ ] Every new component is mounted in the component tree
- [ ] Every state change is consumed by at least one visible element
- [ ] The feature works end-to-end from user perspective (not just unit test)
- [ ] No dead code was introduced (unused components, unwired callbacks)

---

## Part 7: What We Explicitly Exclude (v1)

These are conscious decisions, not gaps:

- **Parametric constraint solver**: No geometric constraints (coincident, perpendicular, tangent, equal). We use grid snap only. This is the Tinkercad model, not the Onshape model.
- **Construction geometry**: No toggle between real and construction lines.
- **Spline/arc tools**: Only circle, rectangle, polygon for v1.
- **Driven vs driving dimensions**: All dimensions are directly editable, no parametric linking.
- **Custom keyboard shortcut/mouse remapping**: Fixed shortcuts for v1. However, the implementation should use an indirection layer (action → keybinding map) so remapping can be added later without refactoring every handler. See "Deferred: Input Remapping" below.
- **Touch/tablet input**: Mouse/keyboard only.
- **Rotation for circles**: No-op (visually meaningless).
- **Resize for polygons**: Complex (vertex editing). Deferred.
- **Resize for imported meshes**: Scale is a later feature.
- **Multi-bin selection**: Bins are not selectable entities in the same way shapes are.
- **Pattern instance editing**: Individual pattern instances are not independently editable (break-instance is planned for US2).

### Deferred: Input Remapping (Plan Now, Build Later)

Users should eventually be able to remap any keyboard shortcut and mouse input (e.g., swap middle-click and right-click for pan, change tool shortcuts, match SolidWorks/Onshape/Fusion360 presets).

**v1 architectural requirement**: All keyboard and mouse bindings must go through a centralized action map — never hardcode `e.code === 'KeyR'` inline. Instead, define actions (`"tool.rectangle"`, `"viewport.pan"`, `"edit.undo"`) and resolve them through a lookup. This costs almost nothing to implement upfront and makes remapping a UI-only change later.

**Future scope (not v1)**:
- Preferences tab for keybinding customization
- Preset profiles (Default, SolidWorks, Onshape, Fusion360)
- Mouse button remapping (pan, orbit, select assignments)
- Per-action conflict detection
- Import/export keybinding configs
