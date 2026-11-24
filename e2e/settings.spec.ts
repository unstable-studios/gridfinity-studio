import { expect, test } from '@playwright/test'
import { StudioApp } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('base unit is locked while the project has bins', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const openGridfinitySettings = async (): Promise<void> => {
    await app.menu('Edit', /^Preferences/)
    await page.getByRole('tab', { name: 'Gridfinity' }).click()
  }
  // The first number field in the tab is the base unit.
  const baseUnit = page.getByRole('tabpanel').getByRole('spinbutton').first()

  await page.getByRole('button', { name: 'New project' }).click()

  await openGridfinitySettings()
  await expect(baseUnit).toBeEnabled()
  await expect(page.getByText('Remove all bins to change the base unit.')).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  await openGridfinitySettings()
  await expect(baseUnit).toBeDisabled()
  await expect(page.getByText('Remove all bins to change the base unit.')).toBeVisible()
  await expect(baseUnit).toHaveValue('42')
  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(baseUnit).toHaveValue('42')
  await page.keyboard.press('Escape')

  // Deleting the bin unlocks it again.
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await page.getByRole('button', { name: 'Delete selected' }).click()
  await openGridfinitySettings()
  await expect(baseUnit).toBeEnabled()

  expect(app.errors).toEqual([])
})

test('the Help menu says where updates stand', async () => {
  app = await StudioApp.launch()
  const { page } = app
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('menuitem', { name: 'Help', exact: true }).click()

  // The app under test was not installed, so it has no update feed to read. It says so,
  // and offers no check that could not work.
  const status = page.getByRole('menuitem', { name: 'This build doesn’t update itself' })
  await expect(status).toBeVisible()
  await expect(status).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: /Check/ })).toHaveCount(0)

  expect(app.errors, 'no renderer errors').toEqual([])
})
