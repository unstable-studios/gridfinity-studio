import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp, readWhenComplete } from './app'
import type { SavedProject } from './app'

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
  await app.page.getByRole('button', { name: 'Create', exact: true }).click()
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

  // A hand-edited or older file: its layout stores a grid size other than its base unit.
  const project = JSON.parse(await readFile(first, 'utf8')) as Grid
  project.gridfinity.baseUnit = 40
  project.layoutSnapshot.gridConfig.size = 42
  await writeFile(edited, JSON.stringify(project))

  // Opened over a project that is already open, as from File > Open project.
  await app.stubOpenDialog(edited)
  await app.menu('File', /^Open project/)
  await app.expectShapeCount(1)

  // Draw, then undo back to the state the file opened in: the grid stays at the base unit.
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 280 }, { x: 880, y: 330 })
  await app.expectShapeCount(2)
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(1)

  await app.stubSaveDialog(reopened)
  await app.menu('File', /^Save as/)
  const saved = await readWhenComplete(
    reopened,
    async (bytes) => JSON.parse(bytes.toString('utf8')) as Grid
  )
  expect(saved.layoutSnapshot.gridConfig.size).toBe(40)
})

test('reopening the open project drops the edits and starts the history over', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'reopen.gfstudio')

  await page.getByRole('button', { name: 'New project' }).click()
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 180 }, { x: 880, y: 230 })
  await app.expectShapeCount(1)
  await app.save(file)

  // An edit that is not saved, with a step of history behind it.
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 280 }, { x: 880, y: 330 })
  await app.expectShapeCount(2)
  await expect(page.getByText('Unsaved', { exact: true })).toBeVisible()

  // The same file again, as the way to throw the edit away.
  await app.stubOpenDialog(file)
  await app.menu('File', /^Open project/)
  await app.expectShapeCount(1)
  await expect(page.getByText('Unsaved', { exact: true })).toHaveCount(0)

  // The history is the opened file's: nothing to undo or redo.
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: /^Redo/ })).toBeDisabled()
  await page.keyboard.press('Escape')

  // Saving to a new file writes what was opened, not the discarded edit. A new file, since
  // the opened one already holds one shape whatever the canvas shows.
  const copy = join(app.dir, 'reopen-copy.gfstudio')
  await app.stubSaveDialog(copy)
  await app.menu('File', /^Save as/)
  const saved = await readWhenComplete(
    copy,
    async (bytes) => JSON.parse(bytes.toString('utf8')) as SavedProject
  )
  expect(saved.layoutSnapshot.shapes).toHaveLength(1)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('a base unit change starts the history over, so undo cannot bring back old bins', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'unit-undo.gfstudio')
  type Grid = {
    gridfinity: { baseUnit: number }
    layoutSnapshot: { gridConfig: { size: number }; groups: unknown[]; shapes: unknown[] }
  }

  await page.getByRole('button', { name: 'New project' }).click()
  // A bin sized for the old unit, added and then deleted: the base unit is locked while one exists.
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await page.getByRole('button', { name: 'Delete selected' }).click()
  await app.expectBinCount(0)

  await app.menu('Edit', /^Preferences/)
  await page.getByRole('tab', { name: 'Gridfinity' }).click()
  await page.getByRole('tabpanel').getByRole('spinbutton').first().fill('40')
  await page.keyboard.press('Escape')

  // Nothing to undo past the change: the bin is not coming back.
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled()
  await page.keyboard.press('Escape')

  // Edits after it undo as usual, and only back to the change.
  await app.selectTool('Rectangle')
  await app.drag({ x: 820, y: 280 }, { x: 880, y: 330 })
  await app.expectShapeCount(1)
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(0)
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled()
  await page.keyboard.press('Escape')

  const saved = (await app.save(file)) as unknown as Grid
  expect(saved.gridfinity.baseUnit).toBe(40)
  expect(saved.layoutSnapshot.gridConfig.size).toBe(40)
  expect(saved.layoutSnapshot.groups).toHaveLength(0)

  expect(app.errors, 'no renderer errors').toEqual([])
})
