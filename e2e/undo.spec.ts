import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('undo and redo work as before after a visit to Preview', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'undo.gfstudio')

  await page.getByRole('button', { name: 'New project' }).click()
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 180 }, { x: 880, y: 230 })
  await app.expectShapeCount(1)
  // Drawing ends with the tool put back to Select.
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 280 }, { x: 880, y: 330 })
  await app.expectShapeCount(2)

  // Round trip: the history is not part of what Preview shows, so it must survive.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await page.getByRole('radio', { name: 'Design', exact: true }).click()
  await app.expectShapeCount(2)

  // Both drawings are still on the history, newest first.
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(1)
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(0)
  await app.menu('Edit', /^Redo/)
  await app.expectShapeCount(1)

  const saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes).toHaveLength(1)

  // A new project starts a history of its own.
  await app.menu('File', /^New project/)
  await app.page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(app.page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled()
})

test('the project base unit sets the grid, not the size stored in its layout', async () => {
  app = await StudioApp.launch()
  const first = join(app.dir, 'unit-42.gfstudio')
  const edited = join(app.dir, 'unit-40.gfstudio')
  const reopened = join(app.dir, 'unit-reopened.gfstudio')
  type Grid = {
    gridfinity: { baseUnit: number }
    layoutSnapshot: { gridConfig: { size: number } }
  }

  await app.page.getByRole('button', { name: 'New project' }).click()
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 180 }, { x: 880, y: 230 })
  await app.save(first)

  // A project whose base unit was changed with nothing drawn since: the layout still says 42.
  const project = JSON.parse(await readFile(first, 'utf8')) as Grid
  project.gridfinity.baseUnit = 40
  project.layoutSnapshot.gridConfig.size = 42
  await writeFile(edited, JSON.stringify(project))

  await app.close()
  app = await StudioApp.launch()
  await app.stubOpenDialog(edited)
  await app.page.getByRole('button', { name: 'Open project' }).click()
  await app.expectShapeCount(1)
  await app.stubSaveDialog(reopened)
  await app.menu('File', /^Save as/)
  await expect.poll(() => readFile(reopened, 'utf8').catch(() => '')).not.toBe('')
  const saved = JSON.parse(await readFile(reopened, 'utf8')) as Grid
  expect(saved.layoutSnapshot.gridConfig.size).toBe(40)
})
