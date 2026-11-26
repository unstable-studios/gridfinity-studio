import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { StudioApp, readWhenComplete } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

/** Triangles in a binary STL: an 80-byte header, the count, then 50 bytes each. */
async function stlTriangles(path: string): Promise<number> {
  return readWhenComplete(path, async (bytes) => {
    const count = bytes.length >= 84 ? bytes.readUInt32LE(80) : -1
    if (bytes.length !== 84 + count * 50) throw new Error(`STL is ${bytes.length} bytes`)
    return count
  })
}

/** How far a binary STL reaches along X. */
async function stlXRange(path: string): Promise<{ min: number; max: number }> {
  await stlTriangles(path)
  const bytes = await readFile(path)
  let min = Infinity
  let max = -Infinity
  for (let triangle = 84; triangle < bytes.length; triangle += 50) {
    // Each triangle is a normal, then three corners of three floats.
    for (let corner = 0; corner < 3; corner++) {
      const x = bytes.readFloatLE(triangle + 12 + corner * 12)
      min = Math.min(min, x)
      max = Math.max(max, x)
    }
  }
  return { min, max }
}

/** The model part of a 3MF file. */
async function threeMfModel(path: string): Promise<string> {
  return readWhenComplete(path, async (bytes) => {
    const zip = await JSZip.loadAsync(bytes)
    const modelFile = Object.keys(zip.files).find((name) => name.endsWith('.model'))
    if (!modelFile) throw new Error('3MF has no .model part')
    return zip.file(modelFile)!.async('string')
  })
}

test('export every bin or only the checked ones', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const bin = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('checkbox', { name: `Export ${name}` })
  const allBins = page.getByRole('checkbox', { name: 'All bins' })

  await page.getByRole('button', { name: 'New project' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  }
  await app.expectBinCount(3)
  await app.save(join(app.dir, 'kit.gfstudio'))

  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toHaveCount(3, { timeout: 30_000 })

  // Every bin starts checked, whatever was selected in Design.
  await expect(allBins).toBeChecked()
  for (const name of ['Bin 1', 'Bin 2', 'Bin 3']) await expect(bin(name)).toBeChecked()
  const allPath = join(app.dir, 'all.stl')
  await app.stubSaveDialog(allPath)
  await app.exportAs('STL')
  const allTriangles = await stlTriangles(allPath)
  expect(await app.lastSaveDialogDefault(), 'named after the project').toBe('kit.stl')

  // With nothing checked there is nothing to export.
  await allBins.click()
  for (const name of ['Bin 1', 'Bin 2', 'Bin 3']) await expect(bin(name)).not.toBeChecked()
  await app.openExport()
  await expect(page.getByText('0 of 3 bins')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export STL…' })).toBeDisabled()
  await expect(page.getByText('Check a bin to export it.')).toBeVisible()
  await page.keyboard.press('Escape')

  // One bin: a third of the triangles, named after the bin.
  await bin('Bin 2').click()
  await expect(allBins).toHaveAttribute('aria-checked', 'mixed')
  const onePath = join(app.dir, 'one.stl')
  await app.stubSaveDialog(onePath)
  await app.exportAs('STL')
  expect(await stlTriangles(onePath)).toBe(allTriangles / 3)
  expect(await app.lastSaveDialogDefault(), 'named after the bin').toBe('Bin 2.stl')

  const oneModelPath = join(app.dir, 'one.3mf')
  await app.stubSaveDialog(oneModelPath)
  await app.exportAs('3MF')
  expect(await threeMfModel(oneModelPath)).toContain('name="Bin 2"')
  expect(await app.lastSaveDialogDefault()).toBe('Bin 2.3mf')

  // Two bins. The File menu exports the same bins.
  await bin('Bin 3').click()
  await app.openExport()
  await expect(page.getByText('2 of 3 bins')).toBeVisible()
  await page.keyboard.press('Escape')
  const twoPath = join(app.dir, 'two.stl')
  await app.stubSaveDialog(twoPath)
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export', exact: true }).hover()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'STL…', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await stlTriangles(twoPath)).toBe((allTriangles / 3) * 2)
  expect(await app.lastSaveDialogDefault()).toBe('kit - 2 bins.stl')

  // The "All bins" box checks the rest.
  await allBins.click()
  await expect(allBins).toBeChecked()
  await expect(bin('Bin 1')).toBeChecked()

  // An unchecked bin does not outlive a visit to Preview: coming back, every bin is checked.
  await bin('Bin 1').click()
  await expect(bin('Bin 1')).not.toBeChecked()
  await page.getByRole('radio', { name: 'Design', exact: true }).click()
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(allBins).toBeChecked()
  await expect(bin('Bin 1')).toBeChecked()

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('export one file per bin into a folder', async () => {
  app = await StudioApp.launch()
  const { page } = app

  await page.getByRole('button', { name: 'New project' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  }
  await app.expectBinCount(3)
  await app.save(join(app.dir, 'kit.gfstudio'))
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toHaveCount(3, { timeout: 30_000 })

  // One file with every bin, to compare with. The third bin is four units right of the first.
  const allPath = join(app.dir, 'all.stl')
  await app.stubSaveDialog(allPath)
  await app.exportAs('STL')
  const allTriangles = await stlTriangles(allPath)
  const all = await stlXRange(allPath)
  expect(all.max - all.min, 'bins keep their places in one file').toBeGreaterThan(150)

  // A file per bin, named after the bins, each with its bin at the origin.
  const folder = join(app.dir, 'parts')
  await mkdir(folder)
  await app.stubOpenDialog(folder)
  await app.openExport()
  await page.getByRole('radio', { name: 'File per bin' }).click()
  await app.exportAs('STL')
  await expect(page.getByText('Exported 3 files to parts')).toBeVisible()
  expect((await readdir(folder)).sort()).toEqual(['Bin 1.stl', 'Bin 2.stl', 'Bin 3.stl'])
  for (const name of ['Bin 1.stl', 'Bin 2.stl', 'Bin 3.stl']) {
    expect(await stlTriangles(join(folder, name)), name).toBe(allTriangles / 3)
    const { min, max } = await stlXRange(join(folder, name))
    expect(Math.abs(min + max), `${name} is centered on the origin`).toBeLessThan(0.01)
  }

  // Exporting there again asks before replacing. Cancel leaves the files alone.
  await writeFile(join(folder, 'Bin 1.stl'), 'old')
  const untouched = (await stat(join(folder, 'Bin 2.stl'))).mtimeMs
  await app.answerReplacePrompt('cancel')
  await app.exportAs('STL')
  await expect.poll(() => app.promptCount()).toBe(1)
  // Long enough for a write that should not happen to show up.
  await page.waitForTimeout(300)
  expect(await readFile(join(folder, 'Bin 1.stl'), 'utf8')).toBe('old')
  expect((await stat(join(folder, 'Bin 2.stl'))).mtimeMs, 'Bin 2 untouched').toBe(untouched)

  await app.answerReplacePrompt('replace')
  await app.exportAs('STL')
  expect(await stlTriangles(join(folder, 'Bin 1.stl'))).toBe(allTriangles / 3)
  expect(await app.promptCount()).toBe(2)

  // One checked bin needs no folder: an ordinary save, still at the origin.
  await page.getByRole('checkbox', { name: 'Export Bin 1' }).click()
  await page.getByRole('checkbox', { name: 'Export Bin 2' }).click()
  const onePath = join(app.dir, 'one.stl')
  await app.stubSaveDialog(onePath)
  await app.exportAs('STL')
  const one = await stlXRange(onePath)
  expect(Math.abs(one.min + one.max)).toBeLessThan(0.01)
  expect(await app.lastSaveDialogDefault()).toBe('Bin 3.stl')

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('click a bin in the 3D view to check or uncheck it', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const checked = page.getByRole('checkbox', { name: /^Export Bin \d$/, checked: true })
  const allBins = page.getByRole('checkbox', { name: 'All bins' })

  await page.getByRole('button', { name: 'New project' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  }
  await app.expectBinCount(3)
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toHaveCount(3, { timeout: 30_000 })
  await expect(checked).toHaveCount(3)

  // The bins are framed in the part of the 3D view the sidebar does not cover, so the middle
  // of that part is on a bin: the row of three is centered there.
  const view = await page.locator('canvas[data-engine^="three"]').boundingBox()
  const sidebar = await page.getByRole('complementary').boundingBox()
  if (!view || !sidebar) throw new Error('Preview is not showing')
  const left = Math.max(view.x, sidebar.x + sidebar.width)
  const x = (left + view.x + view.width) / 2
  const y = view.y + view.height / 2

  // The pointer shows a hand over a bin once the view has framed the bins. Until then the
  // point may be between two of them.
  let nudge = 0
  await expect
    .poll(async () => {
      nudge = 1 - nudge
      await page.mouse.move(x + nudge, y)
      return page.evaluate(() => document.body.style.cursor)
    })
    .toBe('pointer')

  // A click unchecks the bin under it, in the list and for the export.
  await page.mouse.click(x, y)
  await expect(checked).toHaveCount(2)
  await expect(allBins).toHaveAttribute('aria-checked', 'mixed')
  await app.openExport()
  await expect(page.getByText('2 of 3 bins')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: test.info().outputPath('one-left-out.png') })

  // Clicking it again checks it.
  await page.mouse.click(x, y)
  await expect(checked).toHaveCount(3)
  await expect(allBins).toBeChecked()

  // A bin unchecked in the list is checked again by a click in the view, and the other way.
  await allBins.click()
  await expect(checked).toHaveCount(0)
  await page.mouse.click(x, y)
  await expect(checked).toHaveCount(1)
  await allBins.click()
  await expect(checked).toHaveCount(3)

  // A click on a bin that closes Export does only that.
  await app.openExport()
  await page.mouse.click(x, y)
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  await expect(checked).toHaveCount(3)

  // Dragging from a bin orbits the view and changes nothing.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 90, y + 30, { steps: 6 })
  await page.mouse.up()
  // Long enough for a change that should not happen to show up.
  await page.waitForTimeout(300)
  await expect(checked).toHaveCount(3)

  expect(app.errors, 'no renderer errors').toEqual([])
})
