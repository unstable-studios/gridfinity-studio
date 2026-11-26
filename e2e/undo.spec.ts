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
})
