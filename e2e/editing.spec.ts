import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp, mappingFromDrawnRect } from './app'
import type { SavedProject, SavedShape } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('edit bins and pockets', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'edit.gfstudio')
  const shapeById = (p: SavedProject, id: string): SavedShape =>
    p.layoutSnapshot.shapes.find((s) => s.id === id)!

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()

  // The new bin is selected: its W, D and H fields sit side by side inside
  // the sidebar, each clear of the next field's label.
  const sizeFields = await page.evaluate(() => {
    const sidebar = document.querySelector('aside')!
    const fields = [...sidebar.querySelectorAll('button')]
      .filter((b) => /^\d+u$/.test(b.textContent ?? ''))
      .map((field) => {
        const label = field.parentElement!.previousElementSibling!
        return {
          left: label.getBoundingClientRect().left,
          right: field.getBoundingClientRect().right
        }
      })
    return { fields, overflows: sidebar.scrollWidth > sidebar.clientWidth }
  })
  expect(sizeFields.fields, 'W, D and H fields').toHaveLength(3)
  expect(sizeFields.overflows, 'sidebar does not scroll sideways').toBe(false)
  for (let i = 1; i < sizeFields.fields.length; i++) {
    expect(sizeFields.fields[i].left, 'size fields do not overlap').toBeGreaterThanOrEqual(
      sizeFields.fields[i - 1].right
    )
  }

  // Calibrate world→screen from a rectangle drawn on empty canvas.
  const looseFrom = { x: 820, y: 180 }
  const looseTo = { x: 880, y: 230 }
  await app.selectTool('Rect')
  await app.drag(looseFrom, looseTo)
  let saved = await app.save(file)
  const loose = saved.layoutSnapshot.shapes[0]
  const toScreen = mappingFromDrawnRect(loose, looseFrom, looseTo)
  let bin = saved.layoutSnapshot.groups[0]

  // Pocket inside the bin. Saved coordinates of a grouped shape are relative
  // to its bin, so track the pocket's screen position from the drag itself.
  const pocketFrom = toScreen({ x: bin.x + bin.width * 0.3, y: bin.y - bin.height * 0.7 })
  const pocketTo = toScreen({ x: bin.x + bin.width * 0.6, y: bin.y - bin.height * 0.4 })
  const pocketAt = { x: (pocketFrom.x + pocketTo.x) / 2, y: (pocketFrom.y + pocketTo.y) / 2 }
  await app.selectTool('Rect')
  await app.drag(pocketFrom, pocketTo)
  saved = await app.save(file)
  const pocketId = saved.layoutSnapshot.shapes.find((s) => s.id !== loose.id)!.id
  let pocket = shapeById(saved, pocketId)
  expect.soft(pocket.groupId, 'pocket drawn in bin belongs to bin').toBe(bin.id)
  const pocketInBin = pocket

  // Hover shows the tooltip with the pocket depth.
  await page.mouse.move(pocketAt.x + 2, pocketAt.y + 2)
  await page.mouse.move(pocketAt.x, pocketAt.y)
  await expect.soft(page.getByText(/^Depth: (Auto|[\d.]+)/), 'hover tooltip').toBeVisible()

  // Click selects it.
  await page.mouse.click(pocketAt.x, pocketAt.y)
  await expect.soft(page.getByText('Shape properties'), 'click selects pocket').toBeVisible()

  // Turning Auto off gives the pocket an explicit depth.
  expect.soft(pocket.metadata?.pocket?.depth ?? null, 'depth starts on Auto').toBeNull()
  await page.getByRole('switch', { name: 'Auto' }).click()
  saved = await app.save(file)
  expect
    .soft(typeof shapeById(saved, pocketId).metadata?.pocket?.depth, 'explicit depth is saved')
    .toBe('number')

  // Drag the pocket out of the bin, then back in.
  const outside = toScreen({ x: bin.x + bin.width + 60, y: bin.y - bin.height - 60 })
  await app.drag(pocketAt, outside)
  saved = await app.save(file)
  pocket = shapeById(saved, pocketId)
  expect.soft(pocket.groupId, 'dragged out: unassigned').toBeNull()
  expect
    .soft(saved.layoutSnapshot.groups[0].childIds, 'dragged out: bin has no children')
    .toEqual([])

  // The drag is one undo step: undo puts the pocket back in the bin where it
  // was, and redo takes it out again.
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  pocket = shapeById(saved, pocketId)
  expect.soft(pocket.groupId, 'undo drag out: back in the bin').toBe(bin.id)
  expect.soft(pocket.x, 'undo drag out: original x').toBeCloseTo(pocketInBin.x, 0)
  expect.soft(pocket.y, 'undo drag out: original y').toBeCloseTo(pocketInBin.y, 0)
  expect
    .soft(saved.layoutSnapshot.groups[0].childIds, 'undo drag out: bin lists the pocket')
    .toEqual([pocketId])
  await app.menu('Edit', /^Redo/)
  saved = await app.save(file)
  expect.soft(shapeById(saved, pocketId).groupId, 'redo drag out: unassigned').toBeNull()

  await app.drag(outside, pocketAt)
  saved = await app.save(file)
  pocket = shapeById(saved, pocketId)
  expect.soft(pocket.groupId, 'dragged back in: assigned').toBe(bin.id)
  expect.soft(pocket.x, 'back at its original place in the bin').toBeCloseTo(pocketInBin.x, 0)

  // Move the bin one grid unit right; it snaps and its pocket follows.
  const grip = toScreen({ x: bin.x + bin.width * 0.1, y: bin.y - bin.height * 0.1 })
  const unitPx = toScreen({ x: 42, y: 0 }).x - toScreen({ x: 0, y: 0 }).x
  await app.drag(grip, { x: grip.x + unitPx, y: grip.y })
  saved = await app.save(file)
  const moved = saved.layoutSnapshot.groups[0]
  expect.soft(moved.x - bin.x, 'bin moved one 42 mm unit').toBeCloseTo(42, 3)
  expect.soft(moved.y, 'bin stayed on its row').toBeCloseTo(bin.y, 3)
  const afterMove = shapeById(saved, pocketId)
  expect.soft(afterMove.groupId, 'pocket still in bin').toBe(bin.id)
  expect.soft(afterMove.x, 'pocket keeps its place in the bin').toBeCloseTo(pocket.x, 3)
  await page.mouse.move(pocketAt.x + unitPx + 2, pocketAt.y + 2)
  await page.mouse.move(pocketAt.x + unitPx, pocketAt.y)
  await expect
    .soft(page.getByText(/^Depth: (Auto|[\d.]+)/), 'pocket is drawn at moved bin')
    .toBeVisible()
  bin = moved

  // Resize the selected bin from its properties.
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await page.getByRole('button', { name: '3×2', exact: true }).last().click()
  saved = await app.save(file)
  expect
    .soft(saved.layoutSnapshot.groups[0].width, 'bin resized to 3 units wide')
    .toBeCloseTo(126, 3)
  expect
    .soft(saved.layoutSnapshot.groups[0].x, 'resize keeps lower-left corner')
    .toBeCloseTo(bin.x, 3)
  expect.soft(shapeById(saved, pocketId).groupId, 'pocket survives resize').toBe(bin.id)

  // Circle and polygon tools.
  await app.selectTool('Circle')
  await app.drag({ x: 950, y: 180 }, { x: 990, y: 220 })
  await app.selectTool('Polygon')
  for (const p of [
    { x: 1050, y: 180 },
    { x: 1110, y: 180 },
    { x: 1080, y: 240 },
    { x: 1050, y: 180 }
  ]) {
    await page.mouse.click(p.x, p.y)
  }
  saved = await app.save(file)
  expect
    .soft(saved.layoutSnapshot.shapes.map((s) => s.type).sort(), 'all shape tools')
    .toEqual(['circle', 'polygon', 'rect', 'rect'])

  // Delete the loose rectangle with the keyboard.
  await app.selectTool('Select')
  await page.getByRole('button', { name: /^Rectangle 1/ }).click()
  await page.keyboard.press('Delete')
  saved = await app.save(file)
  expect
    .soft(
      saved.layoutSnapshot.shapes.some((s) => s.id === loose.id),
      'Delete removes shape'
    )
    .toBe(false)

  // A second bin never lands on top of the first.
  await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  saved = await app.save(file)
  expect.soft(saved.layoutSnapshot.groups, 'second bin added').toHaveLength(2)
  const [a, b] = saved.layoutSnapshot.groups
  const overlap =
    a &&
    b &&
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y - a.height < b.y &&
    b.y - b.height < a.y
  expect.soft(overlap, 'bins do not overlap').toBe(false)

  expect
    .soft(
      saved.layoutSnapshot.shapes.filter((s) => s.id.startsWith('preview-')),
      'no preview shapes'
    )
    .toEqual([])
  expect.soft(app.errors, 'no renderer errors').toEqual([])
})

test('changing a position in the sidebar is one undo step', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'position.gfstudio')
  // The value button next to the X label; clicking it turns it into an input.
  const xField = page
    .locator('aside')
    .locator('xpath=.//span[normalize-space(.)="X"]/following-sibling::div[1]')

  await page.getByRole('button', { name: 'New project' }).click()
  await app.selectTool('Rect')
  await app.drag({ x: 700, y: 300 }, { x: 780, y: 360 })
  await app.expectShapeCount(1)
  const drawn = (await app.save(file)).layoutSnapshot.shapes[0]

  // Drawing leaves the shape selected, so its properties are showing.
  const target = Math.round(drawn.x) + 10
  await xField.getByRole('button').click()
  await xField.locator('input').fill(String(target))
  await xField.locator('input').press('Enter')
  await expect(xField.getByRole('button')).toHaveText(target.toFixed(1))
  let saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].x, 'moved to the typed X').toBeCloseTo(target, 3)
  expect(saved.layoutSnapshot.shapes[0].y, 'Y untouched').toBeCloseTo(drawn.y, 3)

  await app.menu('Edit', /^Undo/)
  await app.expectShapeCount(1)
  saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].x, 'undo restores X').toBeCloseTo(drawn.x, 3)

  await app.menu('Edit', /^Redo/)
  saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].x, 'redo applies the typed X').toBeCloseTo(target, 3)

  // Undo and redo clear the selection. Select the shape again, then nudge X
  // with the scroll wheel: several steps, one undo step.
  await page.getByRole('button', { name: /^Rectangle 1/ }).click()
  await expect(xField.getByRole('button')).toHaveText(target.toFixed(1))
  await xField.getByRole('button').hover()
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -100)
    await expect(xField.getByRole('button')).not.toHaveText((target + i).toFixed(1))
  }
  // The burst counts as finished once the wheel has been still for a moment.
  await page.waitForTimeout(800)
  saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].x, 'wheel moved the shape').toBeCloseTo(target + 3, 3)
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].x, 'one undo takes back the whole burst').toBeCloseTo(
    target,
    3
  )

  expect(app.errors).toEqual([])
})
