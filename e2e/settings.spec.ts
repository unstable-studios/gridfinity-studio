import { join } from 'node:path'
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

test('new bins start with the project defaults, and new projects with the saved ones', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const openGridfinitySettings = async (): Promise<void> => {
    await app.menu('Edit', /^Preferences/)
    await page.getByRole('tab', { name: 'Gridfinity' }).click()
  }
  const panel = page.getByRole('tabpanel')
  const newBinHeight = panel.getByRole('spinbutton', { name: 'Height', exact: true })
  const newBinLip = panel.getByRole('switch').last()
  const useForNew = panel.getByRole('button', { name: 'Use for new projects' })
  const addBin = async (): Promise<void> => {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  }
  /** Each bin's height and lip, and the project's defaults for new bins, as saved. */
  const saved = async (
    file: string
  ): Promise<{ bins: Array<{ heightUnits: number; hasLip: boolean }>; newBin: unknown }> => {
    const project = (await app.save(join(app.dir, file))) as unknown as {
      gridfinity: { newBin?: unknown }
      layoutSnapshot: { groups: Array<{ metadata: { heightUnits: number; hasLip: boolean } }> }
    }
    return {
      bins: project.layoutSnapshot.groups.map(({ metadata }) => ({
        heightUnits: metadata.heightUnits,
        hasLip: metadata.hasLip
      })),
      newBin: project.gridfinity.newBin
    }
  }

  await page.getByRole('button', { name: 'New project' }).click()

  // A bin starts 3 units high with a lip until the project says otherwise.
  await addBin()
  await app.expectBinCount(1)

  await openGridfinitySettings()
  await expect(newBinHeight).toHaveValue('3')
  await expect(useForNew).toBeDisabled()
  await expect(panel.getByText('New projects start with these settings.')).toBeVisible()
  await newBinHeight.fill('6')
  await newBinLip.click()
  await expect(useForNew).toBeEnabled()
  await expect(panel.getByText('New projects start with different settings.')).toBeVisible()
  await page.keyboard.press('Escape')

  // The next bin has them, the first bin keeps its own, and the project file has both.
  await addBin()
  await app.expectBinCount(2)
  expect(await saved('first.gfstudio')).toEqual({
    bins: [
      { heightUnits: 3, hasLip: true },
      { heightUnits: 6, hasLip: false }
    ],
    newBin: { heightUnits: 6, hasLip: false }
  })

  // Kept as the defaults, a new project starts with them.
  await openGridfinitySettings()
  await useForNew.click()
  await expect(useForNew).toBeDisabled()
  await expect(panel.getByText('New projects start with these settings.')).toBeVisible()
  await page.keyboard.press('Escape')

  await app.menu('File', 'New project')
  await page.getByRole('button', { name: 'Create' }).click()
  await app.expectBinCount(0)
  await addBin()
  await app.expectBinCount(1)
  expect(await saved('second.gfstudio')).toEqual({
    bins: [{ heightUnits: 6, hasLip: false }],
    newBin: { heightUnits: 6, hasLip: false }
  })

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('the user guide and the About dialog open from the Help menu', async () => {
  app = await StudioApp.launch()
  const { page } = app
  await page.getByRole('button', { name: 'New project' }).click()

  // The guide is docs/HELP.md, with its first line as the title.
  await app.menu('Help', 'User guide')
  const guide = page.getByRole('dialog', { name: 'Using Gridfinity Studio' })
  await expect(guide.getByRole('heading', { name: 'Draw pockets' })).toBeVisible()
  await expect(
    guide.getByText(
      'Uncheck a bin in the sidebar to leave it out, or click the bin in the 3D view.'
    )
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(guide).toBeHidden()

  await app.menu('Help', 'About Gridfinity Studio')
  const about = page.getByRole('dialog', { name: 'Gridfinity Studio', exact: true })
  await expect(about.getByText(/^Version v\d+\.\d+\.\d+/)).toBeVisible()
  await expect(about.getByText('This build doesn’t update itself')).toBeVisible()
  await expect(about.getByText(/Electron \d+\.\d+\.\d+, Chromium /)).toBeVisible()

  // Built with: packages the source imports, one that only comes in through another, the
  // runtime, and the fonts. A row opens to the license text.
  const row = (name: string): ReturnType<typeof about.locator> =>
    about.locator('summary > span').filter({ hasText: new RegExp(`^${name}( |$)`) })
  for (const name of ['react', 'three', 'scheduler', 'electron', 'Inter']) {
    await expect(row(name).first(), name).toBeAttached()
  }
  await expect(
    about.locator('summary > span').filter({ hasText: /^@unstable-studios\// })
  ).toHaveCount(0)
  const react = about
    .locator('details')
    .filter({ has: page.locator('summary > span', { hasText: /^react( |$)/ }) })
  await expect(react.getByText('Permission is hereby granted')).toBeHidden()
  await react.locator('summary').click()
  await expect(react.getByText('Permission is hereby granted')).toBeVisible()

  expect(app.errors, 'no renderer errors').toEqual([])
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

test('a bin larger than the print bed is marked, and can still be made', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const tooBig = 'Larger than the print bed.'
  const choosePrinter = async (name: string): Promise<void> => {
    await app.menu('Edit', /^Preferences/)
    await page.getByRole('tab', { name: 'Printer' }).click()
    await page.getByRole('combobox', { name: 'Print bed' }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Print bed' })).toHaveText(name)
    await page.keyboard.press('Escape')
  }
  const row = (bin: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: new RegExp(`^${bin}`) })

  // Five units is 209.5 mm, two is 83.5 mm. Five by two fits a 180 mm bed at no angle.
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '5×2', exact: true }).first().click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(2)

  // With no bed chosen nothing is marked.
  await expect(page.getByTitle(tooBig)).toHaveCount(0)

  // A 180 mm bed: the large bin does not fit, the small one does.
  await choosePrinter('Bambu Lab A1 mini')
  await expect(row('Bin 1').getByTitle(tooBig)).toBeVisible()
  await expect(row('Bin 2').getByTitle(tooBig)).toHaveCount(0)

  // Selected, the bin says how big the bed is.
  await row('Bin 1').click()
  await expect(page.getByText(`${tooBig} The bed is 180 × 180 mm.`)).toBeVisible()

  // Preview names the bin and still builds it.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText('Bin 1 is larger than the print bed.')).toBeVisible()
  await expect(page.getByText(/\bReady$/)).toHaveCount(2, { timeout: 30_000 })
  await page.getByRole('radio', { name: 'Design', exact: true }).click()

  // A 256 mm bed takes it.
  await choosePrinter('Bambu Lab A1, P1, X1')
  await expect(page.getByTitle(tooBig)).toHaveCount(0)

  expect(app.errors, 'no renderer errors').toEqual([])
})
