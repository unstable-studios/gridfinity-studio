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

  for (const tool of ['Rect', 'Circle'] as const) {
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
  await app.selectTool('Rect')
  await app.drag({ x: 700, y: 300 }, { x: 701, y: 301 })
  await app.expectShapeCount(0)
  await openEditMenu()
  await expect(undo, 'tiny drag is not an undo step').toBeDisabled()
  await page.keyboard.press('Escape')

  // A pocket drawn inside a bin is also one step, even though it is both
  // created and assigned to the bin.
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)
  await app.selectTool('Rect')
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
  await app.selectTool('Rect')
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
