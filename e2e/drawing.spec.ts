import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp } from './app'
import type { SavedProject } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('drawing a shape is one undo step and leaves no preview behind', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const undo = page.getByRole('menuitem', { name: /^Undo/ })
  const openEditMenu = (): Promise<void> =>
    page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

  await page.getByRole('button', { name: 'New project' }).click()

  for (const tool of ['Rectangle', 'Ellipse'] as const) {
    await app.selectTool(tool)
    await app.drag({ x: 700, y: 300 }, { x: 780, y: 360 })
    await app.expectShapeCount(1)

    // One undo removes the shape; nothing else is left to undo.
    await app.menu('Edit', /^Undo/)
    await app.expectShapeCount(0)
    await openEditMenu()
    await expect(undo, `${tool}: drawing is a single undo step`).toBeDisabled()
    await page.keyboard.press('Escape')
  }

  // A drag too small to make a shape changes nothing.
  await app.selectTool('Rectangle')
  await app.drag({ x: 700, y: 300 }, { x: 701, y: 301 })
  await app.expectShapeCount(0)
  await openEditMenu()
  await expect(undo, 'tiny drag is not an undo step').toBeDisabled()
  await page.keyboard.press('Escape')

  // A pocket drawn inside a bin is also one step, even though it is both
  // created and assigned to the bin.
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)
  await app.selectTool('Rectangle')
  await app.drag({ x: 400, y: 600 }, { x: 440, y: 640 })
  await app.expectShapeCount(1)
  await page.mouse.move(421, 621)
  await page.mouse.move(420, 620)
  await expect(page.getByText(/^Depth: Auto/), 'the shape landed in the bin').toBeVisible()

  // Reloading the window straight away restores the session copy, with the
  // pocket still inside the bin.
  await page.reload()
  await app.expectBinCount(1)
  await app.expectShapeCount(1)
  const file = join(app.dir, 'pockets.gfstudio')
  await app.stubSaveDialog(file)
  await app.menu('File', /^Save as/)
  await expect.poll(() => readFile(file, 'utf8').catch(() => '')).not.toBe('')
  const reloaded = JSON.parse(await readFile(file, 'utf8')) as SavedProject
  const [bin] = reloaded.layoutSnapshot.groups
  const [first] = reloaded.layoutSnapshot.shapes
  expect(first.groupId, 'reload keeps the pocket in its bin').toBe(bin.id)
  expect(bin.childIds).toEqual([first.id])

  // A second pocket: one undo removes it, and redo brings it back inside
  // the bin.
  await app.selectTool('Rectangle')
  await app.drag({ x: 400, y: 600 }, { x: 440, y: 640 })
  await app.expectShapeCount(2)
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(1)
  await app.expectBinCount(1)
  await openEditMenu()
  await expect(undo, 'pocket in a bin: drawing is a single undo step').toBeDisabled()
  await page.keyboard.press('Escape')
  await app.menu('Edit', /^Redo/)
  await app.expectShapeCount(2)
  const redone = await app.save(file)
  expect(
    redone.layoutSnapshot.shapes.map((s) => s.groupId),
    'redo keeps the pocket in its bin'
  ).toEqual([bin.id, bin.id])
  expect(redone.layoutSnapshot.groups[0].childIds).toHaveLength(2)

  expect(app.errors).toEqual([])
})

test('rectangles and ellipses fit the drag, from a corner or the center', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'modes.gfstudio')
  const from = { x: 700, y: 300 }
  const to = { x: 780, y: 340 }
  /** Draw one shape, save, and return it. Each shape is deleted before the next. */
  const draw = async (
    tool: 'Rectangle' | 'Ellipse',
    keys: Array<'Shift' | 'Alt'>
  ): Promise<{ width: number; height: number; x: number; y: number }> => {
    await app.selectTool(tool)
    await app.dragHolding(keys, from, to)
    await app.expectShapeCount(1)
    const [shape] = (await app.save(file)).layoutSnapshot.shapes
    await page.keyboard.press('Delete')
    await app.expectShapeCount(0)
    return {
      width: shape.width ?? shape.radiusX! * 2,
      height: shape.height ?? shape.radiusY! * 2,
      x: shape.x,
      y: shape.y
    }
  }

  await page.getByRole('button', { name: 'New project' }).click()

  // Corner to corner: the drag is twice as wide as it is tall, and so is the shape.
  const rect = await draw('Rectangle', [])
  expect(rect.width / rect.height, 'rectangle fits the drag').toBeCloseTo(2, 1)

  // The ellipse tool draws an ellipse in the same box, not a circle.
  const ellipse = await draw('Ellipse', [])
  expect(ellipse.width, 'ellipse is as wide as the drag').toBeCloseTo(rect.width, 1)
  expect(ellipse.height, 'ellipse is as tall as the drag').toBeCloseTo(rect.height, 1)
  expect(ellipse.x, 'ellipse sits in the dragged box').toBeCloseTo(rect.x, 1)

  // Shift: a square and a circle, as wide as the longer side of the drag.
  const square = await draw('Rectangle', ['Shift'])
  expect(square.width, 'square takes the longer side').toBeCloseTo(rect.width, 1)
  expect(square.height, 'square has equal sides').toBeCloseTo(square.width, 1)
  const circle = await draw('Ellipse', ['Shift'])
  expect(circle.height, 'circle has equal radii').toBeCloseTo(circle.width, 1)

  // Alt: the drag starts at the middle, so the shape is twice the size and is centered on
  // the corner the others started from.
  const centered = await draw('Rectangle', ['Alt'])
  expect(centered.width, 'from center: twice as wide').toBeCloseTo(rect.width * 2, 1)
  expect(centered.height, 'from center: twice as tall').toBeCloseTo(rect.height * 2, 1)
  expect(centered.x, 'from center: centered on the start').toBeCloseTo(rect.x - rect.width / 2, 1)
  expect(centered.y, 'from center: centered on the start').toBeCloseTo(rect.y - rect.height / 2, 1)

  // Both together: a circle around the start point.
  const centeredCircle = await draw('Ellipse', ['Shift', 'Alt'])
  expect(centeredCircle.width, 'from center, 1:1').toBeCloseTo(rect.width * 2, 1)
  expect(centeredCircle.height, 'from center, 1:1').toBeCloseTo(rect.width * 2, 1)

  expect(app.errors, 'no renderer errors').toEqual([])
})
