# Data Model: Shape-to-Bin Assignment via Drag

## Entities

### LayoutShape (existing, no schema changes)

| Field   | Type            | Description                              |
| ------- | --------------- | ---------------------------------------- |
| id      | string          | Unique shape identifier                  |
| groupId | string \| null  | ID of the owning bin, or null if ungrouped |
| x       | number          | Position x (world-space if ungrouped, group-local if grouped) |
| y       | number          | Position y (world-space if ungrouped, group-local if grouped) |
| type    | ShapeType       | rect, circle, polygon, svgPath, meshImport |
| ...     | ...             | Other fields unchanged                   |

### LayoutGroup (existing, no schema changes)

| Field    | Type     | Description                             |
| -------- | -------- | --------------------------------------- |
| id       | string   | Unique group identifier                 |
| childIds | string[] | IDs of shapes belonging to this group   |
| x        | number   | Lower-left corner x (world-space)       |
| y        | number   | Lower-left corner y (world-space, screen coords) |
| width    | number   | Bin width in world units                |
| height   | number   | Bin height in world units               |
| metadata | BinMetadata \| undefined | Gridfinity bin parameters    |

### Group Membership Relationship

- **Cardinality**: A shape belongs to zero or one groups. A group can have zero or more shapes.
- **Invariants**:
  - If `shape.groupId === groupId`, then `group.childIds` MUST include `shape.id`
  - If `shape.groupId === null`, then no group's `childIds` includes `shape.id`
- **Mutations**: Only via `addToGroup(shapeId, groupId)` and `removeFromGroup(shapeId)`

## New Event

### shapeReassigned (addition to EngineEventMap)

| Field      | Type           | Description                         |
| ---------- | -------------- | ----------------------------------- |
| shapeId    | string         | The shape whose membership changed  |
| oldGroupId | string \| null | Previous group (null if ungrouped)   |
| newGroupId | string \| null | New group (null if now ungrouped)    |

Emitted after a successful reassignment. Triggers tick increment for sidebar reactivity.

## No Schema Changes

The project file schema (v0.5.0) already stores `groupId` on shapes and `childIds` on groups. No migration needed — reassignment changes the runtime data model, which is captured in snapshots automatically.
