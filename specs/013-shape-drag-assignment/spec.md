# Feature Specification: Shape-to-Bin Assignment via Drag

**Feature Branch**: `013-shape-drag-assignment`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Shape-to-bin assignment via drag (#240)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Drag Shape Into a Bin (Priority: P1)

A designer drags an ungrouped pocket shape (rectangle, circle, polygon) from the open canvas onto a bin. When the drag ends with the shape's center point inside the bin's boundary, the shape becomes a child of that bin. The shape stays exactly where it was visually — no jump or snap — but the sidebar now shows it nested under the target bin.

**Why this priority**: This is the core use case — assigning shapes to bins is the primary workflow for organizing pocket layouts. Without drag-in, the only way to associate a shape with a bin is to draw it inside the bin from the start, which is limiting.

**Independent Test**: Create a bin and draw a shape outside it. Drag the shape so its center lands inside the bin. Verify the sidebar shows the shape under the bin, and the shape did not visually jump.

**Acceptance Scenarios**:

1. **Given** an ungrouped shape on the canvas and a bin, **When** the user drags the shape so its center point is inside the bin's boundary and releases, **Then** the shape becomes a child of that bin, the sidebar reflects the new grouping, and the shape's visual position is unchanged.
2. **Given** an ungrouped shape on the canvas and a bin, **When** the user drags the shape but releases with its center point outside all bins, **Then** the shape remains ungrouped.

---

### User Story 2 - Drag Shape Out of a Bin (Priority: P1)

A designer drags a shape that currently belongs to a bin and drops it on empty canvas (outside all bins). The shape is removed from the bin and becomes a top-level ungrouped shape. The sidebar updates to show the shape at the root level. The shape's visual position is preserved — no jump.

**Why this priority**: Equally important as drag-in. Users need to remove shapes from bins to reorganize their layout. Currently dragging a shape out of a bin has no effect on group membership, which is confusing.

**Independent Test**: Create a bin with a shape inside it. Drag the shape outside the bin boundary. Verify the sidebar no longer shows it under the bin, and the shape did not visually jump.

**Acceptance Scenarios**:

1. **Given** a shape inside a bin, **When** the user drags it so its center point is outside all bins and releases, **Then** the shape is removed from the bin, the sidebar shows it as ungrouped, and the shape's visual position is unchanged.
2. **Given** a shape inside a bin, **When** the user drags it but releases with its center still inside the same bin, **Then** nothing changes — the shape stays in the bin.

---

### User Story 3 - Drag Shape Between Bins (Priority: P2)

A designer drags a shape from one bin directly into another bin. The shape is removed from the original bin and added to the target bin in a single operation. The sidebar updates to reflect the new ownership. No visual jump occurs.

**Why this priority**: Natural extension of drag-in and drag-out. Common workflow when reorganizing pocket layouts across multiple bins.

**Independent Test**: Create two adjacent bins, one with a shape. Drag the shape from the first bin into the second. Verify the sidebar shows it under the second bin, and no visual jump occurred.

**Acceptance Scenarios**:

1. **Given** a shape in Bin A and a separate Bin B, **When** the user drags the shape so its center point is inside Bin B and releases, **Then** the shape is removed from Bin A, added to Bin B, and its visual position is unchanged.

---

### User Story 4 - Visual Feedback During Drag (Priority: P2)

While dragging a shape, the bin under the shape's center point is highlighted with a visual indicator (e.g., a colored border or subtle glow), giving the designer a clear signal of which bin the shape will be assigned to if they release. The highlight updates in real time as the shape moves across different bins. If no bin is under the center point, no highlight is shown.

**Why this priority**: Important for usability — without feedback, users cannot predict which bin (if any) a shape will land in until they release.

**Independent Test**: Drag a shape across the canvas, moving it over different bins. Verify that the bin under the shape's center is highlighted, the highlight changes as you move over a different bin, and no highlight appears when over empty canvas.

**Acceptance Scenarios**:

1. **Given** a shape being dragged and a bin on the canvas, **When** the shape's center point is over the bin, **Then** the bin is visually highlighted.
2. **Given** a highlighted bin during drag, **When** the shape's center point moves off the bin, **Then** the highlight is removed.
3. **Given** two adjacent bins, **When** the shape's center point moves from one bin to the other, **Then** the highlight transfers to the new bin.

---

### Edge Cases

- What happens when the shape's center is exactly on the boundary between two bins? The bin whose center is closest to the shape's center point is chosen.
- What happens if the user drags a shape that is part of a multi-selection? Only individual shape drags trigger reassignment — multi-select drags do not reassign shapes.
- What happens when a shape is dragged into a bin and then undo is pressed? The assignment is reverted — the shape returns to its previous group (or becomes ungrouped).
- What happens if a bin is deleted while it contains shapes? Existing behavior applies — all child shapes become ungrouped.
- What happens during pan, zoom, or rubber-band selection? Shape-to-bin reassignment only applies to individual shape drag operations, not canvas navigation or selection tools.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST evaluate shape-to-bin assignment when a shape drag ends, using the shape's center point to determine which bin (if any) contains it.
- **FR-002**: System MUST assign the shape to the containing bin when the center point is inside exactly one bin's boundary at drag end.
- **FR-003**: System MUST remove the shape from its current bin when the center point is outside all bins at drag end.
- **FR-004**: System MUST transfer the shape between bins (remove from old, add to new) when the center point lands inside a different bin than the shape's current bin.
- **FR-005**: System MUST preserve the shape's visual (world-space) position during any group membership change — no visible jump or snap.
- **FR-006**: System MUST highlight the target bin in real time during shape drag, based on which bin contains the shape's center point.
- **FR-007**: System MUST remove the highlight when the shape's center point is not inside any bin.
- **FR-008**: System MUST handle the edge case of the center point being inside multiple bins by choosing the bin whose center is nearest to the shape's center point.
- **FR-009**: System MUST NOT trigger reassignment during multi-select drag operations — only individual shape drags.
- **FR-010**: System MUST reflect group membership changes in the sidebar in real time.
- **FR-011**: System MUST support undo/redo of group membership changes.
- **FR-012**: System MUST behave identically across both supported canvas engines.

### Key Entities

- **Shape (LayoutShape)**: A pocket geometry (rectangle, circle, polygon) that can optionally belong to a bin. Key attributes: position, dimensions, group membership.
- **Bin (LayoutGroup)**: A container representing a Gridfinity bin on the canvas. Key attributes: position, dimensions, list of child shapes.
- **Group Membership**: The relationship between a shape and a bin. A shape belongs to zero or one bins at any time.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can drag a shape into a bin and see the sidebar update within 1 second of releasing the drag.
- **SC-002**: Users can drag a shape out of a bin and see it become ungrouped within 1 second of releasing the drag.
- **SC-003**: Shape visual position is preserved with zero visible jump during any group membership change (sub-pixel accuracy).
- **SC-004**: Target bin highlight updates within 1 frame of the shape's center entering or leaving a bin during drag.
- **SC-005**: All four drag scenarios (into, out of, between, no change) work identically on both supported canvas engines.
- **SC-006**: Undo after a drag reassignment restores the previous group membership in a single step.

## Assumptions

- Bins cannot overlap (enforced by existing collision detection), so the "center inside multiple bins" edge case is a defensive fallback, not a common scenario.
- Shape metadata (pocket depth, etc.) is updated separately from group assignment — this feature only handles the structural relationship, not metadata propagation.
- The existing group management methods handle coordinate conversion correctly when moving shapes between groups and the canvas.
- Only single-shape drags trigger reassignment. Multi-select drags move shapes without re-evaluating group membership.

## Scope Boundaries

### In Scope
- Centroid-based group assignment on drag end
- Real-time target bin highlighting during drag
- Coordinate preservation (no visual jump)
- Sidebar reactivity to group changes
- Undo/redo support via existing snapshot mechanism
- Both canvas engine implementations

### Out of Scope
- Automatic shape metadata updates on reassignment (e.g., pocket depth defaults)
- Drag-and-drop from an external source (file system, etc.)
- Snap-to-grid of shapes within bins after reassignment
- Multi-select shape reassignment
