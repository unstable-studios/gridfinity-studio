import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp } from './app'
import type { SavedProject } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

/** A new project with one bin: unsaved work that closing would lose. */
async function launchWithUnsavedBin(): Promise<StudioApp> {
  const launched = await StudioApp.launch()
  await launched.page.getByRole('button', { name: 'New project' }).click()
  await launched.page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await launched.expectBinCount(1)
  return launched
}

test('closing with unsaved work asks first, and Cancel keeps the app open', async () => {
  app = await launchWithUnsavedBin()

  await app.answerUnsavedPrompt('cancel')
  await app.requestWindowClose()

  await expect.poll(() => app.promptCount(), 'the question was asked').toBe(1)
  expect(await app.hasWindow(), 'the window stays open').toBe(true)
  await app.expectBinCount(1)

  // Asking again works: the first Cancel did not leave the window stuck.
  await app.requestWindowClose()
  await expect.poll(() => app.promptCount()).toBe(2)
  expect(await app.hasWindow()).toBe(true)
})

test('choosing Save on the way out saves, then closes', async () => {
  app = await launchWithUnsavedBin()
  const file = join(app.dir, 'on-close.gfstudio')

  await app.stubSaveDialog(file)
  await app.answerUnsavedPrompt('save')
  await app.requestWindowClose()

  await expect.poll(() => app.hasWindow(), 'the window closes').toBe(false)
  const saved = JSON.parse(await readFile(file, 'utf8')) as SavedProject
  expect(saved.layoutSnapshot.groups, 'the bin was saved').toHaveLength(1)
})

test('choosing Save keeps the app open when the save is dismissed', async () => {
  app = await launchWithUnsavedBin()

  await app.stubDialogsCancelled()
  await app.answerUnsavedPrompt('save')
  await app.requestWindowClose()

  await expect.poll(() => app.cancelledSaveDialogCount(), 'the save dialog came up').toBe(1)
  expect(await app.hasWindow(), 'the window stays open').toBe(true)
  await app.expectBinCount(1)

  // The window is not left waiting on that save: closing asks again.
  await app.answerUnsavedPrompt('cancel')
  await app.requestWindowClose()
  await expect.poll(() => app.promptCount(), 'the question is asked again').toBe(2)
  expect(await app.hasWindow()).toBe(true)
})

test('choosing Don’t save closes without saving', async () => {
  app = await launchWithUnsavedBin()

  await app.answerUnsavedPrompt('discard')
  await app.requestWindowClose()

  await expect.poll(() => app.hasWindow(), 'the window closes').toBe(false)
})

test('quitting with unsaved work asks, and Cancel calls the quit off', async () => {
  app = await launchWithUnsavedBin()

  await app.answerUnsavedPrompt('cancel')
  await app.requestQuit()

  await expect.poll(() => app.promptCount(), 'the question was asked').toBe(1)
  expect(await app.hasWindow(), 'the window stays open').toBe(true)

  // The quit is forgotten: closing the window later asks again and nothing quits.
  await app.requestWindowClose()
  await expect.poll(() => app.promptCount()).toBe(2)
  expect(await app.isRunning(), 'the app is still running').toBe(true)
  expect(await app.hasWindow()).toBe(true)
})

test('quitting and choosing Don’t save quits the app, not just the window', async () => {
  app = await launchWithUnsavedBin()

  await app.answerUnsavedPrompt('discard')
  await app.requestQuit()

  // On a Mac a closed window alone would leave the app running.
  await expect.poll(() => app.isRunning(), 'the app quits').toBe(false)
})

// In these two, the question would be answered Cancel and the window would stay open. The
// window closing is what shows the question was never asked.

test('closing a new project with nothing on the canvas does not ask', async () => {
  app = await StudioApp.launch()
  await app.page.getByRole('button', { name: 'New project' }).click()
  await expect(app.page.getByText('Unsaved', { exact: true })).toBeVisible()

  await app.answerUnsavedPrompt('cancel')
  await app.requestWindowClose()

  await expect.poll(() => app.hasWindow(), 'the window closes').toBe(false)
})

test('closing a project whose changes are saved does not ask', async () => {
  app = await launchWithUnsavedBin()
  await app.save(join(app.dir, 'saved.gfstudio'))

  await app.answerUnsavedPrompt('cancel')
  await app.requestWindowClose()

  await expect.poll(() => app.hasWindow(), 'the window closes').toBe(false)
})
