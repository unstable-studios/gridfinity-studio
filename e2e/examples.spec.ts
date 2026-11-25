import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('an example opens from the welcome screen as a new project, and builds', async () => {
  app = await StudioApp.launch()
  const { page } = app

  // The welcome screen lists the examples.
  for (const name of ['Socket tray', 'Divided tray', 'Tool tray']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
  }

  await page.getByRole('button', { name: /^Tool tray/ }).click()
  await app.expectBinCount(2)
  await app.expectShapeCount(5)

  // Both bins build, with nothing to warn about.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toHaveCount(2, { timeout: 30_000 })
  await expect(page.getByText(/could not be cut|Couldn’t build/)).toHaveCount(0)

  // It has no file yet: saving asks where, and writes the example's bins and shapes.
  await page.getByRole('radio', { name: 'Design', exact: true }).click()
  const saved = await app.save(join(app.dir, 'tool-tray.gfstudio'))
  expect(saved.layoutSnapshot.groups).toHaveLength(2)
  expect(saved.layoutSnapshot.shapes).toHaveLength(5)
  expect(saved.layoutSnapshot.shapes.every((shape) => shape.groupId !== null)).toBe(true)

  expect(app.errors, 'no renderer errors').toEqual([])
})
