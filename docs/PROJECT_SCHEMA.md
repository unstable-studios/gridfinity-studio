# Project file format

A Gridfinity Studio project is one JSON file with the `.gfstudio` extension. This describes schema version `0.5.0`.

The types in [`src/shared/types/project.ts`](../src/shared/types/project.ts) are the source of truth. If this document and the types disagree, the types are right.

## Top level

```typescript
interface ProjectData {
  schemaVersion: string // "0.5.0"
  settings: GlobalSettings
  gridfinity: GridfinityConfig
  layoutSnapshot: LayoutSnapshotData
}
```

All lengths are in millimeters, whatever unit the app shows.

## `settings`

| Field         | Type                     | Notes                                                                                              |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `name`        | string                   | Required, not empty. The project's name until it is saved; after that the app shows the file name. |
| `description` | string                   | Optional.                                                                                          |
| `author`      | string                   | Optional.                                                                                          |
| `createdAt`   | string                   | ISO 8601. Set once, when the project is created.                                                   |
| `modifiedAt`  | string                   | ISO 8601.                                                                                          |
| `units`       | `"mm"`, `"cm"` or `"in"` | The unit lengths are shown in. Stored values stay in millimeters.                                  |

## `gridfinity`

Settings for every bin in the project.

| Field         | Type   | Default       | Notes                                                                                                                                      |
| ------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseUnit`    | number | 42            | Size of one grid square. Greater than 0.                                                                                                   |
| `gridSpacing` | number | 42            | Kept equal to `baseUnit`.                                                                                                                  |
| `unitHeight`  | number | 7             | Height of one height unit. Greater than 0.                                                                                                 |
| `tolerance`   | number | 0.5           | Gap left on each side of a bin: a 1×1 bin is `baseUnit - 2 × tolerance` wide. The presets are 0.5 (standard), 0.6 (loose) and 0.3 (tight). |
| `magnetHoles` | object | on, 6.5 × 2.4 | `enabled`, `diameter`, `depth`.                                                                                                            |
| `screwHoles`  | object | off, 3 × 6    | `enabled`, `diameter`, `depth`.                                                                                                            |

## `layoutSnapshot`

The 2D layout: bins, the shapes drawn in and around them, and the grid. It holds nothing specific to the canvas library.

```typescript
interface LayoutSnapshotData {
  version: string // "1.0.0"
  shapes: LayoutShapeData[]
  groups: LayoutGroupData[]
  gridConfig: { size: number; enabled: boolean; visible: boolean }
}
```

`gridConfig.size` is the grid the canvas draws and snaps bins to. It matches `gridfinity.baseUnit`.

### Coordinates

X grows to the right and **Y grows downward**, as on screen. The app shows positions with Y growing upward; that conversion happens only for display.

### Groups: bins

Each group is a bin.

| Field             | Type     | Notes                                                                                                                                |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | string   | Unique.                                                                                                                              |
| `x`, `y`          | number   | The **lower-left corner**: the smallest x and the largest y. The bin reaches right by `width` and up, toward smaller y, by `height`. |
| `width`, `height` | number   | `widthUnits × baseUnit` and `depthUnits × baseUnit`.                                                                                 |
| `rotation`        | number   | Always 0. Bins are not rotated.                                                                                                      |
| `childIds`        | string[] | The ids of the shapes in the bin.                                                                                                    |
| `style`           | object   | `fill`, `stroke`, `strokeWidth`, and optionally `cornerRadius`. How the bin is drawn on the canvas.                                  |
| `metadata`        | object   | See below.                                                                                                                           |

Bin `metadata`:

| Field                      | Type    | Notes                                                          |
| -------------------------- | ------- | -------------------------------------------------------------- |
| `widthUnits`, `depthUnits` | number  | Size in grid squares.                                          |
| `heightUnits`              | number  | Height in height units. New bins get 3.                        |
| `hasLip`                   | boolean | Whether the bin has a stacking lip.                            |
| `name`                     | string  | Optional. Shown in the sidebar and used for export file names. |

### Shapes

A shape in a bin is a pocket cut into it. A shape in no bin is only a drawing.

Fields every shape has:

| Field                           | Type                   | Notes                                                                                                                   |
| ------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id`                            | string                 | Unique.                                                                                                                 |
| `type`                          | string                 | `"rect"`, `"circle"`, `"polygon"`, `"svgPath"` or `"meshImport"`.                                                       |
| `x`, `y`                        | number                 | The shape's center. For a shape in a bin, measured **from the center of the bin**. Otherwise, a position on the canvas. |
| `rotation`                      | number                 | Degrees, clockwise as seen on screen, about the shape's center.                                                         |
| `groupId`                       | string or null         | The bin the shape is in. Must agree with that bin's `childIds`.                                                         |
| `fill`, `stroke`, `strokeWidth` | string, string, number | How the shape is drawn on the canvas.                                                                                   |
| `metadata`                      | object                 | Optional. See below.                                                                                                    |

Fields by type:

| Type         | Fields                                                   | Notes                                                                                                                           |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `rect`       | `width`, `height`                                        |                                                                                                                                 |
| `circle`     | `radiusX`, `radiusY`                                     | An ellipse. Equal radii make a circle.                                                                                          |
| `polygon`    | `points`                                                 | `{ x, y }` pairs. The shape's `x`, `y` is the center of the box around the points, wherever the points themselves are centered. |
| `svgPath`    | `pathData`, optional `viewBox`, `scaleX`, `scaleY`       | Not cut into bins yet.                                                                                                          |
| `meshImport` | `meshRef`, optional `silhouettePath`, `scaleX`, `scaleY` | Not cut into bins yet.                                                                                                          |

Shape `metadata`:

| Field              | Type   | Notes                                                                                                               |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `name`             | string | Optional. Shown in the sidebar.                                                                                     |
| `pocket.depth`     | number | Optional. How deep the pocket is cut from the top of the bin. When absent, the pocket goes down to the bin's floor. |
| `pocket.clearance` | number | Extra room around the shape. New shapes get 0.25.                                                                   |

## Example

A 2×1 bin with one rectangular pocket in the middle of its left half.

```json
{
  "schemaVersion": "0.5.0",
  "settings": {
    "name": "Workbench drawer",
    "description": "",
    "author": "",
    "createdAt": "2026-11-24T17:00:00.000Z",
    "modifiedAt": "2026-11-24T17:05:00.000Z",
    "units": "mm"
  },
  "gridfinity": {
    "baseUnit": 42,
    "gridSpacing": 42,
    "unitHeight": 7,
    "tolerance": 0.5,
    "magnetHoles": { "enabled": true, "diameter": 6.5, "depth": 2.4 },
    "screwHoles": { "enabled": false, "diameter": 3, "depth": 6 }
  },
  "layoutSnapshot": {
    "version": "1.0.0",
    "shapes": [
      {
        "id": "8d2c0e7a-5a41-4f0e-9d2b-0d7f3c1a9e10",
        "type": "rect",
        "x": -21,
        "y": 0,
        "width": 20,
        "height": 12,
        "rotation": 0,
        "fill": "rgba(168, 85, 247, 0.12)",
        "stroke": "#a855f7",
        "strokeWidth": 1,
        "groupId": "3f6b1a52-7c1d-4c55-b0f1-5f8f0a6d2c44",
        "metadata": { "name": "Rectangle 1", "pocket": { "clearance": 0.25 } }
      }
    ],
    "groups": [
      {
        "id": "3f6b1a52-7c1d-4c55-b0f1-5f8f0a6d2c44",
        "x": 0,
        "y": 0,
        "width": 84,
        "height": 42,
        "rotation": 0,
        "childIds": ["8d2c0e7a-5a41-4f0e-9d2b-0d7f3c1a9e10"],
        "style": {
          "fill": "rgba(96, 165, 250, 0.05)",
          "stroke": "#60a5fa",
          "strokeWidth": 1,
          "cornerRadius": 4
        },
        "metadata": {
          "widthUnits": 2,
          "depthUnits": 1,
          "heightUnits": 3,
          "hasLip": true,
          "name": "Bin 1"
        }
      }
    ],
    "gridConfig": { "size": 42, "enabled": true, "visible": true }
  }
}
```

The bin's lower-left corner is at (0, 0), so it covers x from 0 to 84 and y from -42 to 0. Its center is (42, -21), and the pocket's center is 21 mm to the left of that.

## What is checked when a file is opened

[`project-validator.ts`](../src/shared/validation/project-validator.ts) checks:

- The four top-level fields are present.
- `schemaVersion` is text in the form `1.2.3`.
- `settings`: a name, both dates, and a known unit.
- `gridfinity`: the four numbers, with `baseUnit`, `gridSpacing` and `unitHeight` greater than 0, and both hole settings.

It does not check what is inside `layoutSnapshot`.

## Older files

Files from `0.1.0` to `0.4.0` are converted when opened, by [`migrations.ts`](../src/shared/validation/migrations.ts). Those versions stored bins and entities in their own lists instead of a `layoutSnapshot`. A converted project is written as `0.5.0` the next time it is saved.
