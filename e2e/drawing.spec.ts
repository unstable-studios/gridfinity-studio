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
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(0)
  await app.expectBinCount(1)

  // Redo brings the pocket back inside the bin.
  await app.menu('Edit', /^Redo/)
  await app.expectShapeCount(1)
  const redone = await app.save(join(app.dir, 'redone.gfstudio'))
  const [bin] = redone.layoutSnapshot.groups
  expect(redone.layoutSnapshot.shapes[0].groupId, 'redo keeps the pocket in its bin').toBe(bin.id)
  expect(bin.childIds).toEqual([redone.layoutSnapshot.shapes[0].id])

  // So does reloading the window, which restores the session copy.
  await page.reload()
  await app.expectBinCount(1)
  await app.expectShapeCount(1)
  const reloadedPath = join(app.dir, 'reloaded.gfstudio')
  await app.stubSaveDialog(reloadedPath)
  await app.menu('File', /^Save as/)
  await expect.poll(() => readFile(reloadedPath, 'utf8').catch(() => '')).not.toBe('')
  const reloaded = JSON.parse(await readFile(reloadedPath, 'utf8')) as SavedProject
  expect(reloaded.layoutSnapshot).toEqual(redone.layoutSnapshot)

  expect(app.errors).toEqual([])
})
