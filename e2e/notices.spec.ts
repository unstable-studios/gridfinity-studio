import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

// eslint-disable-next-line no-empty-pattern
test('failed and cancelled file operations tell the person what happened', async ({}, testInfo) => {
  app = await StudioApp.launch()
  const { page } = app
  const toasts = page.locator('[data-sonner-toast]')
  const dismissAll = async (): Promise<void> => {
    for (const close of await page.getByRole('button', { name: 'Close toast' }).all()) {
      await close.click()
    }
    await expect(toasts).toHaveCount(0)
  }
  const missingFolder = join(app.dir, 'no-such-folder')

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  // ── Cancelling a dialog is not an error ─────────────────────────────────
  await app.stubDialogsCancelled()
  await app.menu('File', /^Save(?! as)/)
  await app.menu('File', /^Open project/)
  await expect(page.getByText('Unsaved', { exact: true })).toBeVisible()
  await expect(toasts).toHaveCount(0)

  // ── Save into a folder that does not exist ──────────────────────────────
  await app.stubSaveDialog(join(missingFolder, 'project.gfstudio'))
  await app.menu('File', /^Save(?! as)/)
  await expect(page.getByText('Couldn’t save the project')).toBeVisible()
  await expect(page.getByText('That file or folder no longer exists.')).toBeVisible()
  await expect(page.getByText('Unsaved', { exact: true }), 'still marked unsaved').toBeVisible()
  // Kept in e2e/.results for a human (or agent) to look at; not asserted.
  await page.waitForTimeout(600) // let the enter animation finish
  await page.screenshot({ path: testInfo.outputPath('notice.png') })
  await dismissAll()

  // ── Open a file that is not a project ───────────────────────────────────
  const notAProject = join(app.dir, 'notes.gfstudio')
  await writeFile(notAProject, 'this is not json')
  await app.stubOpenDialog(notAProject)
  await app.menu('File', /^Open project/)
  await expect(page.getByText('Couldn’t open that file')).toBeVisible()
  await expect(
    page.getByText('It isn’t a Gridfinity Studio project, or it is damaged.')
  ).toBeVisible()
  await app.expectBinCount(1) // the project that was open is untouched
  await dismissAll()

  // ── Export: failure, then success ───────────────────────────────────────
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toBeVisible({ timeout: 30_000 })

  await app.stubSaveDialog(join(missingFolder, 'bin.stl'))
  await page.getByRole('button', { name: 'Export STL…' }).click()
  await expect(page.getByText('Couldn’t export')).toBeVisible()
  await dismissAll()

  await app.stubSaveDialog(join(app.dir, 'bin.stl'))
  await page.getByRole('button', { name: 'Export STL…' }).click()
  await expect(page.getByText('Exported bin.stl')).toBeVisible()

  expect(app.errors).toEqual([])
})
