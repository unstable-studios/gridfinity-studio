import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp, mappingFromDrawnRect, readWhenComplete } from './app'
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

test('drag on the canvas to draw a bin on the grid', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const { mouse } = page
  const file = join(app.dir, 'bins.gfstudio')
  const UNIT = 42
  const origin = { x: 700, y: 300 }

  await page.getByRole('button', { name: 'New project' }).click()

  // Draw and delete a rectangle to learn where the grid is on screen.
  await app.selectTool('Rectangle')
  await app.drag(origin, { x: 780, y: 340 })
  await app.expectShapeCount(1)
  const [rect] = (await app.save(file)).layoutSnapshot.shapes
  await page.keyboard.press('Delete')
  await app.expectShapeCount(0)
  const scale = 80 / rect.width!
  const unitPx = UNIT * scale
  const worldAt = (screen: { x: number; y: number }): { x: number; y: number } => ({
    x: rect.x - rect.width! / 2 + (screen.x - origin.x) / scale,
    y: rect.y - rect.height! / 2 + (screen.y - origin.y) / scale
  })
  const column = (screen: { x: number; y: number }): number => Math.floor(worldAt(screen).x / UNIT)
  const row = (screen: { x: number; y: number }): number => Math.floor(worldAt(screen).y / UNIT)

  // Drag a little over one cell to the right: the bin covers every cell the drag touched,
  // and says how big it is on the way.
  // Whole pixels, so the app and this test agree on which cell a point is in.
  const end = { x: Math.round(origin.x + unitPx * 1.2), y: Math.round(origin.y + unitPx * 0.2) }
  const columns = column(end) - column(origin) + 1
  const rows = row(end) - row(origin) + 1
  await app.selectTool('Bin')
  await mouse.move(origin.x, origin.y)
  await mouse.down()
  await mouse.move(end.x, end.y, { steps: 6 })
  await expect(page.getByText(`${columns}×${rows}`, { exact: true })).toBeVisible()
  await mouse.up()
  await app.expectBinCount(1)
  await expect(app.tool('Select')).toBeChecked()
  await expect(page.getByRole('button', { name: /^Bin 1/ })).toHaveAttribute('aria-pressed', 'true')

  const [first] = (await app.save(file)).layoutSnapshot.groups
  expect(first.x, 'left edge is on the grid').toBe(column(origin) * UNIT)
  expect(first.y, 'bottom edge is on the grid').toBe((row(end) + 1) * UNIT)
  expect(first.width).toBe(columns * UNIT)
  expect(first.height).toBe(rows * UNIT)

  // A drag that would land on that bin shows there is no room and draws nothing.
  await app.selectTool('Bin')
  await mouse.move(origin.x, origin.y)
  await mouse.down()
  await mouse.move(Math.round(origin.x - unitPx * 0.5), origin.y, { steps: 4 })
  await expect(page.getByText('No room', { exact: true })).toBeVisible()
  await mouse.up()
  await app.expectBinCount(1)
  await expect(app.tool('Bin')).toBeChecked()

  // Esc calls a drag off.
  await mouse.move(Math.round(origin.x - unitPx * 3), origin.y)
  await mouse.down()
  await mouse.move(Math.round(origin.x - unitPx * 4), origin.y, { steps: 4 })
  await page.keyboard.press('Escape')
  await mouse.up()
  await app.expectBinCount(1)

  // A click in the cell to the left of the bin draws a 1×1 bin that touches it.
  const leftEdge = origin.x - (worldAt(origin).x - first.x) * scale
  await mouse.click(Math.round(leftEdge - unitPx * 0.5), origin.y)
  await app.expectBinCount(2)
  const second = (await app.save(file)).layoutSnapshot.groups.find((g) => g.id !== first.id)!
  expect(second.x + second.width, 'touches the first bin').toBe(first.x)
  expect(second.width).toBe(UNIT)
  expect(second.height).toBe(UNIT)

  // Drawing a bin is one undo step.
  await app.menu('Edit', /^Undo/)
  await app.expectBinCount(1)
  await app.menu('Edit', /^Redo/)
  await app.expectBinCount(2)

  // A bin drawn around a loose shape takes it in, and the bins are not named twice.
  const below = Math.round(origin.y + unitPx * 3)
  await app.selectTool('Rectangle')
  await app.drag({ x: origin.x + 8, y: below }, { x: origin.x + 24, y: below + 12 })
  await app.expectShapeCount(1)
  await app.selectTool('Bin')
  await mouse.click(origin.x + 16, below + 6)
  await app.expectBinCount(3)
  await expect(page.getByRole('button', { name: /^Bin 3/ })).toBeVisible()
  const withPocket = await app.save(file)
  const third = withPocket.layoutSnapshot.groups.find((g) => g.childIds.length > 0)
  expect(third, 'the new bin holds the shape').toBeDefined()
  expect(withPocket.layoutSnapshot.shapes[0].groupId).toBe(third!.id)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('a pocket with no area leaves its bin whole, and Preview says which shape', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const { mouse } = page
  const file = join(app.dir, 'flat.gfstudio')
  const at = { x: 700, y: 300 }

  await page.getByRole('button', { name: 'New project' }).click()
  // A click with the Bin tool draws a bin over the grid square under it.
  await app.selectTool('Bin')
  await mouse.click(at.x, at.y)
  await app.expectBinCount(1)

  // A polygon whose three points are in one line, inside that bin. The line slants, so the
  // box around it has a size and the bin takes the shape in.
  await app.selectTool('Polygon')
  for (const d of [-4, 0, 4]) await mouse.click(at.x + d, at.y + d)
  await page.keyboard.press('Enter')
  await app.expectShapeCount(1)
  const saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].groupId, 'the polygon is in the bin').toBe(
    saved.layoutSnapshot.groups[0].id
  )

  // The bin is built, and the shape that could not be cut is named as the reason.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByText('Bin 1: Polygon 1 could not be cut. Redraw or delete it in Design.')
  ).toBeVisible()

  // An export of it has a bin in it.
  const stlPath = join(app.dir, 'flat.stl')
  await app.stubSaveDialog(stlPath)
  await app.exportAs('STL')
  const triangles = await readWhenComplete(stlPath, async (bytes) => {
    const count = bytes.length >= 84 ? bytes.readUInt32LE(80) : -1
    if (bytes.length !== 84 + count * 50) throw new Error(`STL is ${bytes.length} bytes`)
    return count
  })
  expect(triangles).toBeGreaterThan(100)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('a pocket too close to the wall is marked in Design and named in Preview', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'wall.gfstudio')
  const at = { x: 700, y: 300 }
  const thinWall = 'Leaves a wall thinner than 0.95 mm.'

  await page.getByRole('button', { name: 'New project' }).click()
  await app.selectTool('Bin')
  await page.mouse.click(at.x, at.y)
  await app.expectBinCount(1)

  // A small pocket somewhere in the bin. Saved, it tells where the bin is on screen.
  const from = { x: at.x - 4, y: at.y - 4 }
  const to = { x: at.x + 4, y: at.y + 4 }
  await app.selectTool('Rectangle')
  await app.drag(from, to)
  await app.expectShapeCount(1)

  // The saved pocket is positioned from its bin's center, so the drag that drew it gives the
  // mapping from the bin's own coordinates to the screen.
  const saved = await app.save(file)
  const bin = saved.layoutSnapshot.groups[0]
  const first = saved.layoutSnapshot.shapes[0]
  expect(first.groupId, 'the first pocket is in the bin').toBe(bin.id)
  const toScreen = mappingFromDrawnRect(first, from, to)
  const left = -bin.width / 2

  // A second pocket that starts 0.3 mm inside the bin's left edge.
  await app.selectTool('Rectangle')
  await app.drag(toScreen({ x: left + 0.3, y: -3 }), toScreen({ x: left + 10, y: 3 }))
  await app.expectShapeCount(2)

  // And a third in the middle of the bin.
  await app.selectTool('Rectangle')
  await app.drag(toScreen({ x: -4, y: -4 }), toScreen({ x: 4, y: 4 }))
  await app.expectShapeCount(3)

  // Design marks the shape by the wall, and not the one in the middle.
  await expect(
    page.getByRole('button', { name: /^Rectangle 2/ }).getByTitle(thinWall)
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Rectangle 3/ }).getByTitle(thinWall)).toHaveCount(
    0
  )

  // Preview still builds the bin, and names the shape.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByText(/^Bin 1: (Rectangle 2|2 shapes) leaves? a wall thinner than 0\.95 mm\.$/)
  ).toBeVisible()

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('the Add bin section gets out of the way, and remembers being opened or closed', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const section = page.getByRole('button', { name: 'Add bin', exact: true })
  const size = page.getByRole('button', { name: '1×1', exact: true })

  // An empty project: the size grid is there to start from.
  await page.getByRole('button', { name: 'New project' }).click()
  await expect(section).toHaveAttribute('aria-expanded', 'true')

  // Adding a bin from it keeps it there for the next one.
  await size.first().click()
  await app.expectBinCount(1)
  await expect(section).toHaveAttribute('aria-expanded', 'true')

  // That was not a choice. The next time the app starts on a project with bins, the grid
  // is closed, and the only size grid is the selected bin's own.
  await page.reload()
  await app.expectBinCount(1)
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await expect(size).toHaveCount(1)

  // A bin drawn on the canvas leaves it closed.
  await app.selectTool('Bin')
  await page.mouse.click(900, 250)
  await app.expectBinCount(2)
  await expect(section).toHaveAttribute('aria-expanded', 'false')

  // Opened by its title, it is open the next time too.
  await section.click()
  await expect(section).toHaveAttribute('aria-expanded', 'true')
  await page.reload()
  await expect(section).toHaveAttribute('aria-expanded', 'true')

  // And closed by its title, it stays closed.
  await section.click()
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await page.reload()
  await expect(section).toHaveAttribute('aria-expanded', 'false')

  expect(app.errors, 'no renderer errors').toEqual([])
})
