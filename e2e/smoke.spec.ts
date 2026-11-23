import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { StudioApp, mappingFromDrawnRect } from './app'
import type { SavedProject } from './app'

let app: StudioApp

test.beforeEach(async () => {
  app = await StudioApp.launch()
})

// Playwright requires the fixtures argument to be an object pattern.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach('window', { body: await app.page.screenshot(), contentType: 'image/png' })
  }
  await app.close()
})

// eslint-disable-next-line no-empty-pattern
test('design a bin with a pocket, export it, and reopen the project', async ({}, testInfo) => {
  const { page } = app
  const projectPath = join(app.dir, 'smoke.gfstudio')

  // ── New project, one bin ────────────────────────────────────────────────
  await page.getByRole('button', { name: 'New Project' }).click()
  await page.getByRole('radio', { name: 'Konva', exact: true }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  // ── Draw a rectangle on empty canvas ────────────────────────────────────
  const looseFrom = { x: 820, y: 180 }
  const looseTo = { x: 880, y: 230 }
  await app.selectTool('Rect')
  await app.drag(looseFrom, looseTo)
  await app.expectShapeCount(1)

  // ── Undo and redo ───────────────────────────────────────────────────────
  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(0)
  await app.menu('Edit', /^Redo/)
  await app.expectShapeCount(1)

  // ── Save, then use the saved geometry to find the bin on screen ─────────
  let saved = await app.save(projectPath)
  expect(saved.layoutSnapshot.groups).toHaveLength(1)
  expect(saved.layoutSnapshot.shapes).toHaveLength(1)
  const [loose] = saved.layoutSnapshot.shapes
  expect(loose.groupId).toBeNull()

  const toScreen = mappingFromDrawnRect(loose, looseFrom, looseTo)
  const [bin] = saved.layoutSnapshot.groups
  // Group x/y is the lower-left corner; the bin extends up (−y) by height.
  const pocketFrom = toScreen({ x: bin.x + bin.width * 0.25, y: bin.y - bin.height * 0.75 })
  const pocketTo = toScreen({ x: bin.x + bin.width * 0.7, y: bin.y - bin.height * 0.3 })

  // ── Draw a pocket inside the bin ────────────────────────────────────────
  await app.selectTool('Rect')
  await app.drag(pocketFrom, pocketTo)
  await app.expectShapeCount(2)

  saved = await app.save(projectPath)
  const pocket = saved.layoutSnapshot.shapes.find((s) => s.id !== loose.id)
  expect(pocket, 'second shape is saved').toBeDefined()
  expect(pocket!.groupId, 'pocket drawn inside the bin belongs to it').toBe(bin.id)
  expect(saved.layoutSnapshot.groups[0].childIds).toContain(pocket!.id)
  expect(
    saved.layoutSnapshot.shapes.filter((s) => s.id.startsWith('preview-')),
    'no drawing-preview shapes are persisted'
  ).toHaveLength(0)

  // ── 3D preview ──────────────────────────────────────────────────────────
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/\bready$/)).toBeVisible({ timeout: 30_000 })
  // Kept in e2e/.results for a human (or agent) to look at; not asserted.
  await page.screenshot({ path: testInfo.outputPath('preview.png') })

  // ── Export 3MF: a zip holding a model with real geometry ────────────────
  const threeMfPath = join(app.dir, 'smoke.3mf')
  await app.stubSaveDialog(threeMfPath)
  await page.getByRole('button', { name: 'Export 3MF…' }).click()
  await expect
    .poll(() =>
      readFile(threeMfPath).then(
        (b) => b.length,
        () => 0
      )
    )
    .toBeGreaterThan(0)
  const zip = await JSZip.loadAsync(await readFile(threeMfPath))
  const modelFile = Object.keys(zip.files).find((name) => name.endsWith('.model'))
  expect(modelFile, '3MF contains a .model part').toBeDefined()
  const model = await zip.file(modelFile!)!.async('string')
  expect((model.match(/<vertex /g) ?? []).length).toBeGreaterThan(100)
  expect((model.match(/<triangle /g) ?? []).length).toBeGreaterThan(100)

  // ── Export STL: binary layout is 80-byte header, count, 50 bytes each ───
  const stlPath = join(app.dir, 'smoke.stl')
  await app.stubSaveDialog(stlPath)
  await page.getByRole('button', { name: 'Export STL…' }).click()
  await expect
    .poll(() =>
      readFile(stlPath).then(
        (b) => b.length,
        () => 0
      )
    )
    .toBeGreaterThan(84)
  const stl = await readFile(stlPath)
  const triangleCount = stl.readUInt32LE(80)
  expect(triangleCount).toBeGreaterThan(100)
  expect(stl.length).toBe(84 + triangleCount * 50)

  // ── Reopen the saved project in a fresh session ─────────────────────────
  await app.close()
  app = await StudioApp.launch()
  await app.stubOpenDialog(projectPath)
  await app.page.getByRole('button', { name: 'Open Project' }).click()
  await app.expectBinCount(1)
  await app.expectShapeCount(2)
  // Loading is not an undoable edit.
  await app.page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  await expect(app.page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled()
  await app.page.keyboard.press('Escape')
  const reopenedPath = join(app.dir, 'reopened.gfstudio')
  await app.stubSaveDialog(reopenedPath)
  await app.menu('File', /^Save As/)
  await expect.poll(() => readFile(reopenedPath, 'utf8').catch(() => '')).not.toBe('')
  const reopened = JSON.parse(await readFile(reopenedPath, 'utf8')) as SavedProject
  expect(reopened.layoutSnapshot).toEqual(saved.layoutSnapshot)

  expect(app.errors, 'no renderer errors').toEqual([])
})
