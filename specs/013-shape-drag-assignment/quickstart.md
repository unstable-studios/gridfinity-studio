# Quickstart: Shape-to-Bin Assignment via Drag

## Scenario 1: Drag Ungrouped Shape Into a Bin

1. Create a bin on the canvas (e.g., 2x2 Gridfinity bin)
2. Draw a rectangle shape outside the bin
3. Observe the sidebar shows the shape at the root level (ungrouped)
4. Drag the shape so its center is inside the bin
5. While dragging, observe the bin highlights with a blue border
6. Release the drag
7. Observe:
   - The shape is now listed under the bin in the sidebar
   - The shape did not visually jump — it stayed exactly where you dropped it
   - Undo reverts the shape back to ungrouped

## Scenario 2: Drag Shape Out of a Bin

1. Create a bin with a shape inside it (draw the shape inside the bin)
2. Observe the sidebar shows the shape nested under the bin
3. Drag the shape outside all bins
4. While dragging, observe the bin highlight disappears when the shape center leaves the bin
5. Release the drag
6. Observe:
   - The shape is now at the root level in the sidebar (ungrouped)
   - The shape did not visually jump
   - Undo reverts the shape back into the bin

## Scenario 3: Drag Shape Between Bins

1. Create two bins side by side
2. Draw a shape inside the first bin
3. Drag the shape from the first bin into the second bin
4. While dragging over the second bin, observe it highlights
5. Release the drag
6. Observe:
   - The sidebar shows the shape under the second bin (removed from first)
   - No visual jump occurred
   - Undo reverts the shape back to the first bin

## Scenario 4: Drag Shape — No Change

1. Create a bin with a shape inside it
2. Drag the shape a short distance but release with its center still inside the same bin
3. Observe:
   - No group membership change
   - No unnecessary events or sidebar flicker

## Scenario 5: Multi-Select Drag Does NOT Reassign

1. Create a bin with two shapes
2. Select both shapes (shift-click or rubber-band)
3. Drag the multi-selection outside the bin
4. Release the drag
5. Observe:
   - Shapes remain assigned to the bin (group membership unchanged)
   - Only individual shape drags trigger reassignment

## Scenario 6: Engine Parity

1. Repeat scenarios 1-4 on Fabric engine
2. Switch to Konva engine
3. Repeat scenarios 1-4
4. Observe identical behavior across both engines
