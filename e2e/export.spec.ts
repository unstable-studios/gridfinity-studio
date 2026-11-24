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

  // "Selected" does not outlive a visit to Preview: coming back, an export takes every bin.
  await page.getByRole('button', { name: /^Bin 2/ }).click()
  await scope('Selected (1)').click()
  await expect(scope('Selected (1)')).toBeChecked()
  await page.getByRole('radio', { name: 'Design', exact: true }).click()
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(scope('All bins')).toBeChecked()

  expect(app.errors, 'no renderer errors').toEqual([])
})
