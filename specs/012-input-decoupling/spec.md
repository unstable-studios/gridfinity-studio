# Feature Specification: Input Handling Decoupling

**Feature Branch**: `012-input-decoupling`
**Created**: 2026-03-08
**Status**: Draft
**Input**: Decouple mouse/keyboard input handling from rendering engines (#226)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Canvas Navigation Consistency (Priority: P1)

A user pans and zooms around the layout canvas. Regardless of which rendering engine is active (Fabric or Konva), the navigation experience — Alt-drag to pan, middle-click drag to pan, scroll wheel to zoom around cursor — feels identical in responsiveness, modifier keys, and zoom range.

**Why this priority**: Pan and zoom are the most frequently used interactions. If the decoupled input layer breaks or changes these, every user session is degraded.

**Independent Test**: Can be tested by switching between Fabric and Konva engines and verifying identical pan/zoom behavior (modifier keys, zoom range, cursor-center zoom).

**Acceptance Scenarios**:

1. **Given** the canvas is displayed with either engine, **When** the user holds Alt and drags, **Then** the canvas pans smoothly with no jitter, matching the pointer delta exactly
2. **Given** the canvas is displayed, **When** the user scrolls the mouse wheel, **Then** the canvas zooms centered on the cursor position, clamped between 0.1x and 10x
3. **Given** the user is panning (Alt-drag), **When** the user releases Alt or the mouse button, **Then** pan ends and normal interaction resumes without stale pan state
4. **Given** the user middle-click-drags, **When** they release the middle button, **Then** pan ends identically to Alt-drag pan

---

### User Story 2 - Selection Behavior Parity (Priority: P1)

A user clicks to select shapes and groups, shift-clicks to add/remove from selection, and rubber-band selects by dragging on empty canvas. The selection behavior is identical across both engines.

**Why this priority**: Selection is the prerequisite for all editing operations. Inconsistent selection across engines would make engine switching unreliable.

**Independent Test**: Can be tested by performing click-select, shift-click, and rubber-band selection in both engines and comparing results.

**Acceptance Scenarios**:

1. **Given** a shape exists on the canvas, **When** the user clicks it, **Then** it becomes the sole selection (previous selection cleared)
2. **Given** a shape is selected, **When** the user shift-clicks another shape, **Then** both shapes are selected
3. **Given** two shapes are selected, **When** the user shift-clicks one of them, **Then** that shape is deselected, the other remains
4. **Given** no tool is active, **When** the user clicks and drags on empty canvas, **Then** a rubber-band rectangle appears and all shapes/groups intersecting it are selected on release
5. **Given** shapes are selected, **When** the user clicks empty canvas (no shift), **Then** selection clears

---

### User Story 3 - Group Drag with Snap and Collision (Priority: P1)

A user drags a bin group across the canvas. The group snaps to the module grid and cannot overlap other groups. This behavior must work identically in both engines, including multi-select drag.

**Why this priority**: Grid snap and collision prevention are core to Gridfinity's purpose — bins must align to the grid and not overlap.

**Independent Test**: Can be tested by dragging groups in both engines and verifying snap positions and collision rejection match.

**Acceptance Scenarios**:

1. **Given** a bin group on a 42mm grid, **When** the user drags it and releases, **Then** the group's lower-left corner snaps to the nearest grid intersection
2. **Given** two bin groups, **When** the user drags one to overlap the other, **Then** the drag is rejected and the group reverts to its last valid position with a brief red flash
3. **Given** multiple groups selected, **When** the user drags them, **Then** all groups move together, snapping based on the reference group's lower-left corner
4. **Given** a shape (not a group), **When** the user drags it, **Then** it moves freely with no grid snapping

---

### User Story 4 - Group Resize with Edge Anchoring (Priority: P2)

A user resizes a bin group by dragging its edge or corner handle. The resize snaps to grid increments, anchors the opposite edge, and prevents collisions. A preview overlay shows the proposed size.

**Why this priority**: Resize is less frequent than drag but still critical for bin configuration. The edge-anchoring and preview logic is heavily duplicated today.

**Independent Test**: Can be tested by resizing groups from different edges/corners in both engines and verifying anchoring, snap, collision prevention, and overlay appearance.

**Acceptance Scenarios**:

1. **Given** a bin group selected, **When** the user drags the right edge, **Then** the left edge stays fixed, width snaps to grid increments, and a dashed overlay shows the proposed size
2. **Given** a resize would cause overlap with another group, **Then** the overlay turns red and on release the resize is rejected (group reverts)
3. **Given** a resize from a corner, **When** the user releases, **Then** both dimensions snap to grid and the diagonally opposite corner stays fixed

---

### User Story 5 - New Engine Adapter Simplicity (Priority: P3)

A developer adding a new rendering engine (e.g., PixiJS, raw Canvas2D) only needs to implement a focused action-handler interface, not re-implement gesture recognition, snap math, collision logic, or keyboard shortcut handling.

**Why this priority**: The primary motivation for this refactor — reducing the surface area for new engine adapters.

**Independent Test**: Can be assessed by reviewing the action-handler interface and confirming it contains only engine-specific rendering commands, not input logic.

**Acceptance Scenarios**:

1. **Given** a new engine adapter, **When** the developer implements the action-handler interface, **Then** pan, zoom, selection, snap, and collision work without any gesture-recognition code in the adapter
2. **Given** the shared input layer, **When** a new input mode is needed (e.g., touch gestures), **Then** it can be added to the gesture recognizer without modifying any engine adapter

---

### Edge Cases

- What happens when the user starts panning (Alt-down) and then the browser window loses focus before mouse-up? Pan state must reset cleanly.
- What happens when the user drags a group to the canvas edge during pan? The viewport should not auto-scroll (current behavior).
- What happens during a rubber-band selection if the user presses Alt mid-drag? The rubber-band should cancel and pan should begin.
- What happens when engine is switched (Fabric ↔ Konva) mid-interaction (e.g., during a drag)? Any in-progress interaction should be cancelled cleanly.
- What happens when zoom is at the 0.1x or 10x limit and the user continues scrolling? Zoom should clamp silently with no jitter.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a single gesture-recognition layer that captures pointer, wheel, and keyboard events from the canvas container and translates them into semantic actions
- **FR-002**: The system MUST define an action-handler interface that engine adapters implement to receive high-level commands (pan, zoom, select, drag, resize)
- **FR-003**: The gesture recognizer MUST detect pan gestures via Alt-key + primary button drag and middle-button drag
- **FR-004**: The gesture recognizer MUST detect zoom gestures via scroll wheel and compute the zoom center from cursor position
- **FR-005**: The gesture recognizer MUST detect click-select (primary button on target), shift-click-select (shift + primary on target), and rubber-band select (primary drag on empty canvas)
- **FR-006**: Snap-to-grid logic (lower-left corner rounding to grid spacing) MUST be implemented once in a shared module, not duplicated per engine
- **FR-007**: Collision detection and rejection logic MUST remain in a shared module, invoked by the input layer or engine during drag/resize finalization
- **FR-008**: Edge-anchor calculation for group resize MUST be implemented once in a shared module
- **FR-009**: The input layer MUST suppress shape/node dragging during pan to prevent engines from interpreting pan gestures as shape drags
- **FR-010**: The input layer MUST handle pointer capture for drag and pan operations to prevent events from leaking to other elements
- **FR-011**: The system MUST emit the same engine events (shapeMoved, groupMoved, groupResized, selectionChanged, viewportChanged, collisionRejected) regardless of which engine is active
- **FR-012**: The system MUST cleanly cancel any in-progress interaction when the engine is switched or disposed

### Key Entities

- **GestureRecognizer**: Stateful input processor that owns DOM event listeners on the canvas container. Produces semantic gesture events (pan, zoom, select, drag, rubber-band). No knowledge of shapes or engine internals.
- **InputActionHandler**: Interface implemented by each engine adapter. Receives high-level commands and translates them to native engine API calls.
- **Shared Business Logic**: Pure functions for snap-to-grid calculation, collision detection, edge-anchor computation, and resize dimension quantization. Already partially exists in `collision.ts`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All existing canvas interactions (pan, zoom, select, drag, resize, collision, snap) work identically before and after the refactor — verified by existing contract tests and manual smoke testing
- **SC-002**: The duplicated input-handling code across engine adapters is reduced by at least 50% (measured by lines removed from engine files)
- **SC-003**: A new engine adapter can implement the action-handler interface with zero gesture-recognition code — verified by interface review
- **SC-004**: No regression in interaction responsiveness — pan, zoom, and drag feel identical to the current implementation
- **SC-005**: The cross-engine roundtrip contract tests continue to pass with no modifications to test assertions
