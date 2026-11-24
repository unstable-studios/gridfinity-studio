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

test('export every bin or only the selected ones', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const exportStl = page.getByRole('button', { name: 'Export STL…' })
  const scope = (name: string | RegExp): ReturnType<typeof page.getByRole> =>
    page.getByRole('radio', { name })

  await page.getByRole('button', { name: 'New project' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  }
  await app.expectBinCount(3)
  await app.save(join(app.dir, 'kit.gfstudio'))

  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bReady$/)).toHaveCount(3, { timeout: 30_000 })

  // The bin added last is still selected, but an export takes every bin until asked.
  await expect(scope('All bins')).toBeChecked()
  await expect(scope('Selected (1)')).toBeEnabled()
  const allPath = join(app.dir, 'all.stl')
  await app.stubSaveDialog(allPath)
  await exportStl.click()
  const allTriangles = await stlTriangles(allPath)
  expect(await app.lastSaveDialogDefault(), 'named after the project').toBe('kit.stl')

  // One bin: a third of the triangles, named after the bin.
  await page.getByRole('button', { name: /^Bin 2/ }).click()
  await scope('Selected (1)').click()
  const onePath = join(app.dir, 'one.stl')
  await app.stubSaveDialog(onePath)
  await exportStl.click()
  expect(await stlTriangles(onePath)).toBe(allTriangles / 3)
  expect(await app.lastSaveDialogDefault(), 'named after the bin').toBe('Bin 2.stl')

  const oneModelPath = join(app.dir, 'one.3mf')
  await app.stubSaveDialog(oneModelPath)
  await page.getByRole('button', { name: 'Export 3MF…' }).click()
  expect(await threeMfModel(oneModelPath)).toContain('name="Bin 2"')
  expect(await app.lastSaveDialogDefault()).toBe('Bin 2.3mf')

  // Two bins, picked with Shift. The File menu exports the same bins.
  await page.getByRole('button', { name: /^Bin 3/ }).click({ modifiers: ['Shift'] })
  await expect(scope('Selected (2)')).toBeChecked()
  const twoPath = join(app.dir, 'two.stl')
  await app.stubSaveDialog(twoPath)
  await page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export', exact: true }).hover()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('menuitem', { name: 'STL…', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  expect(await stlTriangles(twoPath)).toBe((allTriangles / 3) * 2)
  expect(await app.lastSaveDialogDefault()).toBe('kit - 2 bins.stl')

  // With nothing selected there is only one choice left.
  await page.getByRole('button', { name: /^Bin 2/ }).click()
  await page.getByRole('button', { name: /^Bin 2/ }).click({ modifiers: ['ControlOrMeta'] })
  await expect(scope('Selected (0)')).toBeDisabled()
  await expect(scope('All bins')).toBeChecked()

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('export one file per bin into a folder', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const exportStl = page.getByRole('button', { name: 'Export STL…' })

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
  await exportStl.click()
  const allTriangles = await stlTriangles(allPath)
  const all = await stlXRange(allPath)
  expect(all.max - all.min, 'bins keep their places in one file').toBeGreaterThan(150)

  // A file per bin, named after the bins, each with its bin at the origin.
  const folder = join(app.dir, 'parts')
  await mkdir(folder)
  await app.stubOpenDialog(folder)
  await page.getByRole('radio', { name: 'File per bin' }).click()
  await exportStl.click()
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
  await exportStl.click()
  await expect.poll(() => app.promptCount()).toBe(1)
  // Long enough for a write that should not happen to show up.
  await page.waitForTimeout(300)
  expect(await readFile(join(folder, 'Bin 1.stl'), 'utf8')).toBe('old')
  expect((await stat(join(folder, 'Bin 2.stl'))).mtimeMs, 'Bin 2 untouched').toBe(untouched)

  await app.answerReplacePrompt('replace')
  await exportStl.click()
  expect(await stlTriangles(join(folder, 'Bin 1.stl'))).toBe(allTriangles / 3)
  expect(await app.promptCount()).toBe(2)

  // One selected bin needs no folder: an ordinary save, still at the origin.
  await page.getByRole('button', { name: /^Bin 3/ }).click()
  await page.getByRole('radio', { name: 'Selected (1)' }).click()
  const onePath = join(app.dir, 'one.stl')
  await app.stubSaveDialog(onePath)
  await exportStl.click()
  const one = await stlXRange(onePath)
  expect(Math.abs(one.min + one.max)).toBeLessThan(0.01)
  expect(await app.lastSaveDialogDefault()).toBe('Bin 3.stl')

  expect(app.errors, 'no renderer errors').toEqual([])
})
