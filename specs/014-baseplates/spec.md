# Feature Specification: Baseplates

**Feature Branch**: `014-baseplates` (built in several PRs, see [Delivery](#delivery))
**Created**: 2026-11-28
**Status**: Draft, for agreement on #601
**Input**: #601 "Generate baseplates", and the direction on it: modular and extensible, magnets
and screw holes to start; baseplates handled like artboards in Illustrator, in their own mode;
moving, copying or deleting a baseplate optionally takes its contents, set per project; drawer
bounds shown in baseplate mode, with alignment of the baseplates inside them; export like bins;
cut by print bed size.

The decisions still open are listed under [Open questions](#open-questions). Everything else
is a proposal that holds unless one of them changes it.

## What a baseplate is

A baseplate is the grid the bins stand on: a plate of whole Gridfinity cells, each with the
socket a bin's foot drops into. In the app it is a rectangle of `widthUnits × depthUnits` cells
on the canvas, under the bins, with:

- **Features**: what is cut into or added to the plate. Magnet holes and screw holes to start,
  each with its own settings. More can be added later, each as one module (see
  [Modularity](#modularity)).
- **Padding**: solid frame added outside the cells on each side (left, right, front, back), in
  mm, so the plate fills a drawer that is not a whole number of cells.
- **Cuts**: where the plate is split into pieces that fit the print bed, if it is split.

A project has any number of baseplates, like a document has any number of artboards. Bins are
not owned by a baseplate: a bin is "on" a baseplate when its center is inside it, using the same
centroid rule as pockets in bins (`containment.ts`).

## User Scenarios & Testing

### User Story 1 - Add and edit baseplates in baseplate mode (P1)

A Baseplate tool joins the toolbar. Choosing it enters baseplate mode, like the artboard tool:

- Bins and pockets are dimmed and cannot be selected or moved. Baseplates can.
- Dragging on empty canvas draws a new baseplate, snapped to whole cells.
- A baseplate can be selected (click, rubber band, shift-click), moved, resized from its
  handles (whole cells only), copied, pasted and deleted, with the usual shortcuts and menus.
- The sidebar shows the selected baseplate's name, size in cells, padding and features.
- Escape or the Select tool leaves baseplate mode.

Outside baseplate mode baseplates are drawn under everything else, outlined with their cell
grid, and cannot be selected, so they never get in the way of bins.

Every change is one undo step, named in History ("Add baseplate", "Move baseplate and 3 bins").

**Acceptance**:

1. **Given** an empty project, **When** the person chooses the Baseplate tool and drags out a
   rectangle 3 × 2 cells, **Then** a 3 × 2 baseplate appears, is listed in the sidebar and is
   selected.
2. **Given** baseplate mode, **When** the person clicks a bin, **Then** nothing is selected.
3. **Given** a baseplate, **When** the person leaves baseplate mode and clicks on it,
   **Then** it is not selected and a bin drawn there lands on top of it.

### User Story 2 - Contents follow the baseplate (P1)

A checkbox in baseplate mode, "Move contents with baseplate", saved with the project and on by
default (Illustrator's "Move/Copy Artwork with Artboard").

- When it is on, moving a baseplate moves the bins on it, with their pockets; copying a
  baseplate copies them too; deleting a baseplate deletes them too (see question 5).
- When it is off, only the baseplate changes.
- Which bins are "on" it is decided when the gesture starts, so a bin is not picked up or
  dropped halfway through a drag.

**Acceptance**:

1. **Given** the checkbox on and two bins on a baseplate, **When** the baseplate is moved one
   cell right, **Then** both bins move one cell right, and one undo puts all three back.
2. **Given** the checkbox off, **When** the same move is made, **Then** the bins stay.

### User Story 3 - Drawer bounds and alignment (P2)

In baseplate mode the person can set the drawer (or tray) size: width and depth in mm. The
drawer is drawn as an outline on the canvas. With a drawer set:

- An alignment control with left / center / right and front / middle / back aligns the selected
  baseplates, taken together, inside the drawer. With "Move contents" on, their bins go with
  them.
- **Fill drawer** creates the largest baseplate that fits (less a clearance, 0.5 mm per side by
  default), placed by the current alignment. If it is larger than the print bed it is offered
  for splitting (Story 5).
- **Pad to drawer** sets the selected baseplates' padding so that, with the alignment, they
  fill the drawer less the clearance. This is "where the extra space goes": aligned left, the
  padding is all on the right.

Without a drawer set, the alignment and fill controls are disabled and say why.

**Acceptance**:

1. **Given** a drawer 300 × 200 mm, **When** the person chooses Fill drawer with center
   alignment, **Then** a 7 × 4 baseplate appears centered in the drawer outline.
2. **Given** that baseplate, **When** the person chooses Pad to drawer, **Then** its padding is
   about 2.5 mm left and right and 15.5 mm front and back, and its outline meets the drawer
   less the clearance.

### User Story 4 - Baseplates in the 3D preview and export (P1)

In the preview, baseplates are listed with the bins, each with a checkbox, and shown under the
bins that stand on them, with the bins raised to sit in the sockets. Export works as for bins:
the checked items in one file (3MF with one object per item, or one STL) or one file each.
A split baseplate exports as its pieces, plus any loose joint parts.

**Acceptance**:

1. **Given** a baseplate with magnet holes and a bin on it, **When** the person opens the
   preview, **Then** both are shown, the bin in the plate's sockets, and the magnet holes are
   visible from below.
2. **Given** the baseplate checked and the bin unchecked, **When** the person exports 3MF,
   **Then** the file holds only the baseplate, and it is watertight.

### User Story 5 - Split a baseplate for the print bed (P2)

With a print bed chosen (the setting from #507), a baseplate larger than the bed is marked on
the canvas as bins are (#584), and offers "Split for print bed". Splitting:

- Cuts along cell boundaries only, so every piece is whole cells (plus the padding on its
  outer sides).
- The app proposes the fewest cuts that fit the bed, spread so the pieces are as even as
  possible. The cuts are drawn on the baseplate and can be dragged to another cell boundary;
  a cut that would make a piece too large for the bed is refused.
- Adds an interlocking joint at each cut (see question 1).
- Keeps the baseplate as one item on the canvas; the cuts are a setting of it, saved with the
  project, so the file opens the same on another computer whose bed is different. Changing the
  bed later marks baseplates whose pieces no longer fit.
- Is one undo step.

The cut logic is shared with splitting bins (#585), as far as their answers allow.

**Acceptance**:

1. **Given** a 256 × 256 mm bed and an 8 × 5 baseplate (336 × 210 mm), **When** the person
   chooses Split for print bed, **Then** one cut is made, between cells 4 and 5, and each piece
   fits the bed with its joint.
2. **Given** the split baseplate, **When** it is exported as one file each, **Then** there is
   one file per piece.

### Edge cases

- A bin across two baseplates belongs to the one its center is on, or neither if the center is
  on neither. Where overlapping baseplates both hold the center, it belongs to the one whose
  center is nearest, as `findContainingBinGroup` breaks ties for pockets, so a bin is never
  the contents of two baseplates at once.
- Baseplates may overlap; they are not pushed apart like bins. Overlap is marked, since the
  plates could not both be printed and laid there.
- A bin larger than any baseplate is fine: baseplates do not constrain bins.
- A drawer smaller than one cell: Fill drawer is disabled and says why.
- Resizing a baseplate so that a cut falls outside it removes that cut.

## Requirements

### Data model

New in the project file (schema 0.6.0, with a migration from 0.5.0 that adds the empty parts):

```ts
// layoutSnapshot.baseplates — engine-agnostic, like groups
interface LayoutBaseplateData {
  id: string
  name?: string
  x: number // lower-left corner of the cells, as for groups
  y: number
  widthUnits: number
  depthUnits: number
  padding: { left: number; right: number; front: number; back: number } // mm
  features: BaseplateFeature[] // see Modularity
  cuts?: { x: number[]; y: number[] } // cell boundaries, counted from the left / front
}

// layoutSnapshot.drawer — in the snapshot, so aligning or filling the drawer and the change
// it causes to baseplates are one undo step
interface DrawerData {
  x: number
  y: number
  width: number
  depth: number
  clearance: number
}

// project.baseplates — project-wide baseplate preferences, not part of undo
interface BaseplateSettings {
  moveContents: boolean // default true
}
```

If question 2 is answered A, the grid origin goes in `layoutSnapshot.gridConfig` for the same
reason.

- The validator checks baseplates as it checks groups (unique ids, numbers, known feature
  types). An unknown feature type makes the file invalid: a new feature module raises the
  schema version (with a migration that has nothing to convert), because an older app that
  ignored the feature would export a different plate. An older app then refuses the file as
  `too-new`, which is what the format already does.
- The whole 0.6.0 format (baseplates with padding, features and cuts, the drawer and the
  preference) is defined, validated and saved from the first PR, even before the controls that
  set each part exist, so no release in between drops a part it does not know yet.
- `docs/PROJECT_SCHEMA.md` and `docs/HELP.md` are updated in the PRs that build each part.

### Layout engine

- `LayoutEngine` gains baseplate operations (add, update, remove, list, hit testing in
  baseplate mode) and a mode switch that changes what can be selected. Konva draws baseplates
  in a layer under the bins. It also gains drawer operations (set, update, remove), and Konva
  draws the drawer outline in baseplate mode. Baseplates and the drawer are part of
  `LayoutSnapshot`, so undo and redo, save and open cover them with no extra work.
- "Contents" is computed outside the adapter, from snapshots (`containment.ts`), so it is the
  same for any engine.
- Positions shown in the sidebar use `position-frame.ts`, like everything else.

### Geometry

- Cells follow the published Gridfinity baseplate profile (0.7 mm 45° chamfer, 1.8 mm
  vertical, 2.15 mm 45° chamfer, 4.65 mm in all, at 42 mm pitch). This is its own profile, not
  derived from the bin foot in `BASE_PROFILE` (steps 0.8 / 1.8 / 2.35 mm high, 4.95 mm tall),
  which differs from it. The numbers go in `gridfinity-dimensions.ts` as
  `BASEPLATE_PROFILE`, next to the bin's, and are checked against the spec when built.
- A plain plate is the profile alone. A feature can ask for a solid layer under the profile
  (magnets need their depth plus a floor); the plate's base is the thickest any feature asks
  for.
- Built in the geometry worker with Manifold, as bins are, by a `buildBaseplateCSG` behind the
  same interface the bin builder uses, from 2D profiles and extrusions, so it moves to replicad
  with the bins when #224 lands. A baseplate bakes and caches like a bin.

### Modularity

Each feature is a module registered in one list, holding everything about it:

```ts
interface BaseplateFeatureModule<Settings> {
  type: string // stored in the file, never renamed
  label: string
  defaults(project: GridfinityConfig): Settings
  validate(raw: unknown): Settings | null
  Editor: React.ComponentType<{ value: Settings; onChange(next: Settings): void }>
  baseThickness(settings: Settings): number // solid needed under the profile
  add?(cells: CellGrid, settings: Settings): Solid // material added, in the worker
  cut?(cells: CellGrid, settings: Settings): Solid // material removed, in the worker
}
```

Magnet holes and screw holes are the first two modules. A weighted base, a lightweight plate,
a different joint or a label tab are later modules, each added as one module. Joints follow the
same pattern (`BaseplateJointModule`), so a second kind of joint can be added later.

- **Magnet holes**: at the four corners of each cell, 8 mm in from its edges (as on bins);
  diameter and depth default to the project's magnet settings (6.5 × 2.4 mm).
- **Screw holes**: see question 4 for which kind.

Features that share a place need no rule between them: the builder joins the plate and every
module's `add`, then subtracts every module's `cut`, so a cut always wins over an addition. Bin screw holes sit at the
magnet positions, so with both on, each corner gets the magnet pocket and the narrower screw
hole through its floor, the usual Gridfinity design.

Adding a feature module touches the registry and one more place: the schema version is raised
with a migration that has nothing to convert (see Data model). The cost is that an older app
refuses every file a newer one saves, even one that does not use the new feature.

### Export

- `export-plan.ts` takes items that are bins or baseplates (or baseplate pieces). Today's
  naming stays for bins: the project's name when everything is checked, the item's name when
  one is, and "project - N bins" otherwise. New rules for baseplates: one unnamed baseplate
  is "project - baseplate"; several baseplates and no bins are "project - N baseplates"; a piece
  of a split one is "<baseplate name, or project - baseplate> - piece 2 of 3"; a mix of bins
  and baseplates is "project - N items".
- 3MF and STL writers are unchanged; they get more meshes.

### Tests

- Unit: cell and padding geometry, fill and pad maths, cut proposal and refusal, contents
  selection, the 0.5.0 → 0.6.0 migration, validation, watertight export of every feature and
  of split pieces.
- Contract: the engine's baseplate operations and mode.
- End-to-end (`e2e/`): baseplate mode → draw a baseplate → move it with a bin on it →
  set a drawer and fill it → preview → export → reopen. Extended in each PR that adds a flow.

## Delivery

One PR per step, each usable on its own and passing `pnpm verify`:

1. Schema 0.6.0 and migration (the whole format, see Data model), baseplates in the engine and
   snapshot, baseplate mode: draw, select, move, resize, copy, delete, sidebar. No 3D yet.
2. Geometry: plain plate, magnet holes, screw holes; preview and export.
3. "Move contents with baseplate".
4. Drawer bounds, alignment, Fill drawer, Pad to drawer.
5. Split for print bed and the joint (with #585's cut logic).
6. Move the builder to replicad when #224 lands.

## Open questions

1. **Joint between split pieces.** The plate is thin (4.65 mm, and the cell walls come to a
   point at the top), so where the joint goes matters.
   - **A. Jigsaw tabs in the base** (recommended): tabs and sockets cut through the solid
     layer under the profile along each cut. Prints in place, no extra parts. Needs a base
     layer, so a split plate gets one (about 2.5 mm) even without magnets.
   - **B. Separate clips**: dovetail or butterfly slots in the underside of both pieces, and
     small keys exported alongside. Works on thinner plates; more parts to print and fit.
   - **C. Both**, chosen per baseplate (the joint is a module either way; this decides what is
     built first).
2. **The grid when a baseplate is aligned off the grid.** Centering in a drawer usually puts the
   plate a fraction of a cell off the canvas grid, and bins must snap to the plate's cells.
   - **A. The canvas grid follows** (recommended): the canvas grid gets an origin, and aligning
     moves it with the baseplates, so bins keep snapping to one grid that matches the plates.
     All baseplates in the project share it, which suits one drawer.
   - **B. Each baseplate has its own grid**: bins snap to the cells of the baseplate under them.
     Supports plates with different offsets in one project; snapping gets harder to predict.
   - **C. Baseplates stay on the canvas grid**, and aligning moves the drawer outline instead.
     Simplest, but the drawer is no longer where it was drawn.
3. **How many drawers per project.**
   - **A. One** (recommended for now): one outline, set in baseplate mode.
   - **B. Several**, each a named outline that can be drawn, with baseplates aligned inside
     the one they are in. Fits a project per cabinet; more to build.
4. **What "screw holes" means on a baseplate.**
   - **A. Holes to screw the plate to the drawer**: a countersunk hole in the middle of each
     cell (or every other cell).
   - **B. Holes for bins' screws**: M3 holes under each bin's screw positions, so bins can be
     screwed down.
   - **C. Both**, as two features (recommended, since each is small once the module exists).
5. **Deleting a baseplate with "Move contents" on**: delete its bins too (as the checkbox reads
   for move and copy, and undoable), or leave the bins and only take them along for move and
   copy (as Illustrator does when deleting an artboard)?
