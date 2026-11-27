# Using Gridfinity Studio

Design Gridfinity bins with pockets shaped for your tools, check them in 3D, and export them for printing.

## Start a project

Choose **New project** on the welcome screen to start right away, or **File > New project** to set a name, a base unit and a tolerance first. The welcome screen also has three examples to open and change.

Work is saved as a `.gfstudio` file. **File > Save** saves it, and the **Unsaved** mark in the top bar does the same.

## Add bins

Open **Add bin** in the sidebar and pick a size, or choose the **Bin** tool and drag on the canvas. Bins snap to the grid and can't overlap.

Select a bin to change its width, depth and height, or to turn the stacking lip off. A bin grows to the right and upward. If another bin is in the way, it grows the other way or moves to the nearest place its new size fits, and says so. With no room nearby it stays as it is, and the notice names the bin in the way.

## Draw pockets

Choose **Rectangle**, **Ellipse** or **Polygon** and draw inside a bin. Each pocket is cut into the bin to its own depth.

- **Shift** draws a square or a circle.
- **Alt** (Option on a Mac) draws from the center.
- **Ctrl** (Command on a Mac) snaps to 1 mm.
- With the **Polygon** tool, click to add points. Click the first point or press **Enter** to finish, and **Esc** to cancel.

Select a pocket to set its depth, size and position. A pocket drawn too close to the wall or the stacking lip is marked with a warning.

## Select and arrange

- Click to select, and drag to move. Where shapes overlap, a click selects the smallest one under the pointer.
- **Shift+click** adds to the selection.
- When you drop pockets, each one goes to the bin its center is in.
- When you resize a bin, pockets whose center is inside it join it, and its pockets whose center is now outside it leave it, for the bin their center is in if there is one. If a size set in the sidebar or the right-click menu doesn't fit where the bin is, the bin moves with its pockets and takes in the pockets at its new spot.
- Select two or more pockets to align them from the sidebar, and three or more to space them evenly. One pocket can be centered in its bin.
- Right-click a bin or pocket for cut, copy, paste, rename and delete. The menu has more, depending on what is under the pointer:
  - A bin: turn its stacking lip on or off, add an empty bin beside it, add or remove a column or a row, make it taller or shorter, or go to Preview to export it on its own.
  - Pockets: align and distribute them, set how deep they are cut, move them to another bin, or take them out of their bin.
  - Empty canvas: add a bin there, paste what was copied there, or reset the view.
- Scroll to zoom, and drag with the middle button to pan.

**Edit > Undo** and **Redo** step through every change. **History**, in the corner of the canvas, lists the steps by what they did. Click one to go straight to it; the steps after it stay until you make a new change.

## Preview

Switch to **Preview** to see the bins in 3D, with the stacking lip, feet, and magnet and screw holes. Drag to orbit, scroll to zoom, and drag with the right button to pan.

The sidebar lists each bin and says when it is ready. Warnings about pockets that could not be cut, or that leave a thin wall, are listed below.

## Export

In Preview, choose **Export** in the top bar, then **Export 3MF…** or **Export STL…**.

With more than one bin:

- Uncheck a bin in the sidebar to leave it out, or click the bin in the 3D view. A bin that is left out is shown gray and see-through.
- Choose **File per bin** to save each bin as its own file in a folder.

## Project settings

Tolerance, unit height, and magnet and screw holes are set per project in **Edit > Preferences…**, under **Gridfinity**. The base unit can be changed there only while the project has no bins.

**New bins** sets the height and stacking lip a bin starts with. Bins already in the project keep their own.

**Use for new projects** keeps the project's settings as what every new project starts with. Preferences shows the app's settings under **App** and the project's under **This project**.

## Print bed

Choose your printer in **Edit > Preferences…**, under **Printer**, or choose **Custom** and enter the bed's width and depth. A bin too large for the bed at any angle is outlined in amber on the canvas and marked with ⚠ in the bin list. Preview names it when it is checked for export. It can still be made and exported.

The bed is kept on this computer, for every project.

## Updates

The app checks for updates when it starts and every hour, and offers to restart when one is ready. **Help > Check for updates** checks at once.
