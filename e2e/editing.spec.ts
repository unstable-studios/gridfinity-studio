import { readFile } from 'node:fs/promises'
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
  await app.selectTool('Rectangle')
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
  await app.selectTool('Rectangle')
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

  // A depth change is an edit like any other: it marks the project unsaved
  // and can be undone and redone. First a typed depth.
  const fullDepth = shapeById(saved, pocketId).metadata!.pocket!.depth as number
  const depthField = page
    .locator('aside')
    .locator('xpath=.//span[normalize-space(.)="mm"]/following-sibling::div[1]')
  await depthField.getByRole('button').click()
  await depthField.locator('input').fill('5')
  await depthField.locator('input').press('Enter')
  await expect
    .soft(page.getByText('Unsaved', { exact: true }), 'typed depth is unsaved')
    .toBeVisible()
  saved = await app.save(file)
  expect.soft(shapeById(saved, pocketId).metadata?.pocket?.depth, 'typed depth is saved').toBe(5)
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect
    .soft(shapeById(saved, pocketId).metadata?.pocket?.depth, 'undo restores the depth before')
    .toBe(fullDepth)

  // Then the Auto switch. Undo cleared the selection, so select again.
  await page.mouse.click(pocketAt.x, pocketAt.y)
  await page.getByRole('switch', { name: 'Auto' }).click()
  await expect
    .soft(page.getByText('Unsaved', { exact: true }), 'depth change is unsaved')
    .toBeVisible()
  saved = await app.save(file)
  expect.soft(shapeById(saved, pocketId).metadata?.pocket?.depth ?? null, 'back on Auto').toBeNull()
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect
    .soft(typeof shapeById(saved, pocketId).metadata?.pocket?.depth, 'undo restores the depth')
    .toBe('number')
  await app.menu('Edit', /^Redo/)
  saved = await app.save(file)
  expect.soft(shapeById(saved, pocketId).metadata?.pocket?.depth ?? null, 'redo: Auto').toBeNull()
  await app.menu('Edit', /^Undo/)

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
  await app.selectTool('Ellipse')
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
  await app.selectTool('Rectangle')
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

test('a pocket position reads on the canvas or in its bin', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'frame.gfstudio')
  const xValue = page
    .locator('aside')
    .locator('xpath=.//span[normalize-space(.)="X"]/following-sibling::div[1]')
  const yValue = page
    .locator('aside')
    .locator('xpath=.//span[normalize-space(.)="Y"]/following-sibling::div[1]')
  const frame = (name: 'Canvas' | 'Bin'): ReturnType<typeof page.getByRole> =>
    page.getByRole('radiogroup', { name: 'Relative to' }).getByRole('radio', { name, exact: true })

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  // Calibrate world→screen from a rectangle drawn on empty canvas. A shape
  // outside every bin is on the canvas already, so there is nothing to pick.
  const looseFrom = { x: 820, y: 180 }
  const looseTo = { x: 880, y: 230 }
  await app.selectTool('Rectangle')
  await app.drag(looseFrom, looseTo)
  await app.expectShapeCount(1)
  await expect(frame('Bin')).toHaveCount(0)
  let saved = await app.save(file)
  const loose = saved.layoutSnapshot.shapes[0]
  const toScreen = mappingFromDrawnRect(loose, looseFrom, looseTo)
  const bin = saved.layoutSnapshot.groups[0]
  // The file stores Y increasing downward, and a pocket relative to its
  // bin's center. The sidebar shows the origin at the lower left with Y
  // increasing upward: the canvas origin, or the bin's lower-left corner.
  const binCenterX = bin.x + bin.width / 2
  const binCenterY = bin.y - bin.height / 2
  const fixed = (n: number): string => n.toFixed(1).replace(/^-(0\.0)$/, '$1')

  // A pocket in the bin, left of center. Drawing leaves it selected.
  await app.selectTool('Rectangle')
  await app.drag(
    toScreen({ x: bin.x + bin.width * 0.2, y: bin.y - bin.height * 0.7 }),
    toScreen({ x: bin.x + bin.width * 0.4, y: bin.y - bin.height * 0.5 })
  )
  await app.expectShapeCount(2)
  saved = await app.save(file)
  const pocketId = saved.layoutSnapshot.shapes.find((s) => s.id !== loose.id)!.id
  const pocket = (p: SavedProject): SavedShape =>
    p.layoutSnapshot.shapes.find((s) => s.id === pocketId)!
  const storedX = pocket(saved).x
  const storedY = pocket(saved).y
  expect(pocket(saved).groupId).toBe(bin.id)
  // Drawn left of and above the bin's center.
  expect(storedX).toBeLessThan(0)
  expect(storedY).toBeLessThan(0)

  // Canvas is the default: X and Y are where the pocket is on the canvas,
  // with Y increasing upward.
  await expect(frame('Canvas')).toBeChecked()
  await expect(xValue.getByRole('button')).toHaveText(fixed(binCenterX + storedX))
  await expect(yValue.getByRole('button')).toHaveText(fixed(-binCenterY - storedY))

  // Bin measures from the bin's lower-left corner. A pocket left of and
  // above center is less than half-way across and more than half-way up.
  await frame('Bin').click()
  await expect(xValue.getByRole('button')).toHaveText(fixed(storedX + bin.width / 2))
  await expect(yValue.getByRole('button')).toHaveText(fixed(bin.height / 2 - storedY))
  expect(storedX + bin.width / 2).toBeLessThan(bin.width / 2)
  expect(bin.height / 2 - storedY).toBeGreaterThan(bin.height / 2)

  // Typing a larger Y moves the pocket up, which is a smaller stored Y.
  const higher = Math.round(bin.height / 2 - storedY) + 4
  await yValue.getByRole('button').click()
  await yValue.locator('input').fill(String(higher))
  await yValue.locator('input').press('Enter')
  await expect(yValue.getByRole('button')).toHaveText(fixed(higher))
  saved = await app.save(file)
  expect(pocket(saved).y, 'moved up').toBeCloseTo(bin.height / 2 - higher, 3)
  expect(pocket(saved).y).toBeLessThan(storedY)
  await app.menu('Edit', /^Undo/)
  await page.getByRole('button', { name: /^Rectangle 2/ }).click()

  // Relative to the bin, a value past the edge stops at the edge, so the
  // pocket stays in the bin and the number shown is where it is.
  await xValue.getByRole('button').click()
  await xValue.locator('input').fill('1000')
  await xValue.locator('input').press('Enter')
  await expect(xValue.getByRole('button')).toHaveText(fixed(bin.width))
  saved = await app.save(file)
  expect(pocket(saved).groupId, 'still in the bin').toBe(bin.id)
  expect(pocket(saved).x, 'at the right edge').toBeCloseTo(bin.width / 2, 3)
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect(pocket(saved).x, 'undo puts it back').toBeCloseTo(storedX, 3)
  expect(pocket(saved).y).toBeCloseTo(storedY, 3)

  // The choice of frame is kept. Undo cleared the selection, so select the
  // pocket again, then go back to the canvas.
  await page.getByRole('button', { name: /^Rectangle 2/ }).click()
  await expect(frame('Bin')).toBeChecked()
  await frame('Canvas').click()

  // A value typed on the canvas reads back as typed, and moves the pocket by
  // the difference.
  const typed = Math.round(binCenterX + storedX) + 6
  await xValue.getByRole('button').click()
  await xValue.locator('input').fill(String(typed))
  await xValue.locator('input').press('Enter')
  await expect(xValue.getByRole('button')).toHaveText(fixed(typed))
  saved = await app.save(file)
  expect(pocket(saved).x, 'stored relative to the bin').toBeCloseTo(typed - binCenterX, 3)
  expect(pocket(saved).groupId).toBe(bin.id)

  // Typed far enough to leave the bin: the pocket is unassigned and the
  // field still shows what was typed.
  const outside = Math.round(bin.x + bin.width + 30)
  await xValue.getByRole('button').click()
  await xValue.locator('input').fill(String(outside))
  await xValue.locator('input').press('Enter')
  await expect(xValue.getByRole('button')).toHaveText(fixed(outside))
  await expect(frame('Bin')).toHaveCount(0)
  saved = await app.save(file)
  expect(pocket(saved).groupId, 'left the bin').toBeNull()
  expect(pocket(saved).x, 'stored on the canvas').toBeCloseTo(outside, 3)

  expect(app.errors).toEqual([])
})

test('a bin cannot be resized onto its neighbor from the sidebar', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'resize.gfstudio')
  const firstBinWidth = async (): Promise<number> => {
    const { groups } = (await app.save(file)).layoutSnapshot
    return [...groups].sort((a, b) => a.x - b.x)[0].width
  }

  // Two 1×1 bins: the second lands one grid unit to the right of the first.
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  await app.expectBinCount(2)
  const unit = await firstBinWidth()

  // With the first bin selected, the second size grid in the sidebar is its own.
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  const sizeGrid = (size: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: size, exact: true }).nth(1)

  // Three wide would cover the second bin: refused, with a notice.
  await sizeGrid('3×1').click()
  await expect(page.getByText('Not enough room to resize')).toBeVisible()
  expect(await firstBinWidth(), 'bin keeps its size').toBe(unit)

  // Two wide only touches it: allowed.
  await sizeGrid('2×1').click()
  expect(await firstBinWidth(), 'bin grows to meet its neighbor').toBe(unit * 2)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('bins added from the size grid fill rows and never overlap', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'rows.gfstudio')

  await page.getByRole('button', { name: 'New project' }).click()
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: '1×1', exact: true }).first().click()
    await app.expectBinCount(i + 1)
  }
  const { groups } = (await app.save(file)).layoutSnapshot
  const unit = groups[0].width

  // Six fit in a row with a unit between them. The seventh starts the next row.
  const places = groups.map((g) => `${g.x / unit},${g.y / unit}`)
  expect(places).toEqual(['0,0', '2,0', '4,0', '6,0', '8,0', '10,0', '0,2'])

  // Deleting one leaves a gap, and the next bin goes there.
  await page.getByRole('button', { name: /^Bin 3/ }).click()
  await page.getByRole('button', { name: 'Delete selected' }).click()
  await app.expectBinCount(6)
  await page.getByRole('button', { name: '1×1', exact: true }).first().click()
  await app.expectBinCount(7)
  const refilled = (await app.save(file)).layoutSnapshot.groups
  expect(refilled.filter((g) => g.x === 4 * unit && g.y === 0)).toHaveLength(1)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('rows in the sidebar select with Shift and Cmd or Ctrl', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const row = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: new RegExp(`^${name}`) })
  const selectedRows = page.locator('aside button[aria-pressed="true"]')

  await page.getByRole('button', { name: 'New project' }).click()
  for (const y of [200, 300, 400]) {
    await app.selectTool('Rectangle')
    await app.drag({ x: 700, y }, { x: 760, y: y + 40 })
  }
  await app.expectShapeCount(3)

  // A plain click selects one row. Shift reaches from it to the row clicked.
  await row('Rectangle 1').click()
  await expect(selectedRows).toHaveCount(1)
  await row('Rectangle 3').click({ modifiers: ['Shift'] })
  await expect(selectedRows).toHaveCount(3)

  // Cmd or Ctrl takes one row out of the selection.
  await row('Rectangle 2').click({ modifiers: ['ControlOrMeta'] })
  await expect(selectedRows).toHaveCount(2)
  await expect(row('Rectangle 2')).toHaveAttribute('aria-pressed', 'false')

  // The canvas has the same selection: Delete removes the two selected shapes.
  await page.keyboard.press('Delete')
  await app.expectShapeCount(1)
  await expect(row('Rectangle 2')).toBeVisible()

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('bins and shapes can be renamed', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const row = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: new RegExp(`^${name}`) })

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  // In Bin properties: type a name and press Enter.
  const binName = page.getByRole('textbox', { name: 'Bin name' })
  await expect(binName).toHaveValue('Bin 1')
  await binName.fill('Screws')
  await binName.press('Enter')
  await expect(row('Screws')).toBeVisible()

  // A rename is one undo step. Undo also clears the selection, so the panel closes.
  await app.menu('Edit', /^Undo/)
  await expect(row('Bin 1')).toBeVisible()
  await app.expectBinCount(1)

  // Double-click a row to rename it in place. The field takes the keyboard.
  await row('Bin 1').dblclick()
  await page.keyboard.type('Nails')
  await page.keyboard.press('Enter')
  await expect(row('Nails')).toBeVisible()

  // Esc keeps the old name, and so does an empty one.
  await row('Nails').dblclick()
  await page.keyboard.type('Oops')
  await page.keyboard.press('Escape')
  await expect(row('Nails')).toBeVisible()
  await binName.fill('')
  await binName.press('Enter')
  await expect(binName).toHaveValue('Nails')

  // Shapes rename the same way, and typing in the field does not delete the shape.
  await app.selectTool('Rectangle')
  await app.drag({ x: 700, y: 300 }, { x: 780, y: 360 })
  await app.expectShapeCount(1)
  const shapeName = page.getByRole('textbox', { name: 'Shape name' })
  await shapeName.fill('Calipers')
  await shapeName.press('Backspace')
  await shapeName.press('Enter')
  await expect(row('Caliper')).toBeVisible()
  await app.expectShapeCount(1)

  // Saving while a name is still being typed keeps the name: no Enter, straight to save.
  const file = join(app.dir, 'renamed.gfstudio')
  await app.stubSaveDialog(file)
  await shapeName.fill('Wrench')
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+s`)
  await expect(page.getByText('Unsaved', { exact: true })).toHaveCount(0)
  const saved = JSON.parse(await readFile(file, 'utf8')) as SavedProject
  expect(saved.layoutSnapshot.shapes[0].metadata?.name, 'the typed name is in the file').toBe(
    'Wrench'
  )

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('cut, copy and paste bins and shapes', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'clipboard.gfstudio')
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  const editItem = async (name: string): Promise<ReturnType<typeof page.getByRole>> => {
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    return page.getByRole('menuitem', { name: new RegExp(`^${name}`) })
  }

  await page.getByRole('button', { name: 'New project' }).click()

  // Nothing to paste or copy yet.
  await expect(await editItem('Paste')).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: /^Copy/ })).toBeDisabled()
  await page.keyboard.press('Escape')

  // A bin with a pocket in it. Find the pocket's bin from the saved file.
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.selectTool('Rectangle')
  await app.drag({ x: 400, y: 600 }, { x: 440, y: 640 })
  await app.expectShapeCount(1)
  let saved = await app.save(file)
  expect(saved.layoutSnapshot.shapes[0].groupId, 'pocket is in the bin').not.toBeNull()

  // Copy the bin and paste it: a second bin with its own pocket, clear of the first.
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await page.keyboard.press(`${mod}+c`)
  await page.keyboard.press(`${mod}+v`)
  await app.expectBinCount(2)
  await app.expectShapeCount(2)
  saved = await app.save(file)
  const [first, second] = [...saved.layoutSnapshot.groups].sort((a, b) => a.x - b.x)
  expect(second.x, 'pasted bin is clear of the first').toBeGreaterThanOrEqual(first.x + first.width)
  expect(second.childIds, 'pasted bin has its own pocket').toHaveLength(1)
  expect(first.childIds).toHaveLength(1)
  expect(second.childIds[0]).not.toBe(first.childIds[0])
  await expect(page.getByRole('button', { name: /^Bin 1 copy/ })).toBeVisible()

  // The paste is one undo step, and redo brings it back.
  await app.menu('Edit', /^Undo/)
  await app.expectBinCount(1)
  await app.expectShapeCount(1)
  await app.menu('Edit', /^Redo/)
  await app.expectBinCount(2)
  await app.expectShapeCount(2)

  // Cut the copy from the menu: it goes, pocket and all.
  await page.getByRole('button', { name: /^Bin 1 copy/ }).click()
  await (await editItem('Cut')).click()
  await app.expectBinCount(1)
  await app.expectShapeCount(1)

  // Copy the pocket on its own and paste it: the copy lands beside it, in the same bin.
  await page.getByRole('button', { name: /^Rectangle 1/ }).click()
  await (await editItem('Copy')).click()
  await (await editItem('Paste')).click()
  await app.expectShapeCount(2)
  saved = await app.save(file)
  const [bin] = saved.layoutSnapshot.groups
  expect(bin.childIds, 'the pasted pocket joins the bin it lands in').toHaveLength(2)
  const [original, copy] = saved.layoutSnapshot.shapes
  expect(copy.x, 'the paste lands beside the original').not.toBe(original.x)

  // Typing in a field keeps the keys for the text.
  const binName = page.getByRole('textbox', { name: 'Bin name' })
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await binName.focus()
  await page.keyboard.press(`${mod}+a`)
  await page.keyboard.press(`${mod}+v`)
  await app.expectShapeCount(2)
  await app.expectBinCount(1)
  await page.keyboard.press('Escape')

  // Select all picks the bin. Its pockets come along with it, so they are not picked again.
  await page.keyboard.press(`${mod}+a`)
  await expect(page.locator('aside button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Bin 1/ })).toHaveAttribute('aria-pressed', 'true')

  // Delete takes the bin with everything in it, as one undo step.
  await page.keyboard.press('Delete')
  await app.expectShapeCount(0)
  await expect(page.getByText(/^Bins \(\d+\)$/)).toHaveCount(0)
  await app.menu('Edit', /^Undo/)
  await app.expectBinCount(1)
  await app.expectShapeCount(2)

  // A cut bin pastes back where it was.
  const before = (await app.save(file)).layoutSnapshot.groups[0]
  await page.getByRole('button', { name: /^Bin 1/ }).click()
  await page.keyboard.press(`${mod}+x`)
  await app.expectShapeCount(0)
  await page.keyboard.press(`${mod}+v`)
  await app.expectBinCount(1)
  await app.expectShapeCount(2)
  const after = (await app.save(file)).layoutSnapshot.groups[0]
  expect({ x: after.x, y: after.y }, 'cut and paste puts the bin back').toEqual({
    x: before.x,
    y: before.y
  })
  expect(after.childIds).toHaveLength(2)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('right-click a bin or shape for its menu', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const row = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: new RegExp(`^${name}`) })
  const menuItem = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('menuitem', { name, exact: true })
  const selectedRows = page.locator('aside button[aria-pressed="true"]')
  const emptyCanvas = { x: 900, y: 250 }

  // A bin with a pocket in it.
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.selectTool('Rectangle')
  await app.drag({ x: 400, y: 600 }, { x: 440, y: 640 })
  await app.expectShapeCount(1)

  // In the sidebar: a right-click selects the row and opens the menu.
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y)
  await expect(selectedRows).toHaveCount(0)
  // While the menu is open the page behind it is hidden from lookups by role, so the
  // selected row is counted by its attribute instead.
  await row('Bin 1').click({ button: 'right' })
  await expect(selectedRows).toHaveCount(1)
  await menuItem('Duplicate').click()
  await app.expectBinCount(2)
  await app.expectShapeCount(2)

  await row('Bin 1 copy').click({ button: 'right' })
  await menuItem('Delete').click()
  await app.expectBinCount(1)
  await app.expectShapeCount(1)

  // On the canvas: a right-click on the pocket selects it. Rename types in the sidebar row.
  await page.mouse.click(420, 620, { button: 'right' })
  await expect(selectedRows).toHaveText(/^Rectangle 1/)
  await menuItem('Rename').click()
  // The rename starts once the menu has closed. The row's field is the first of the two.
  await expect(page.getByRole('textbox', { name: 'Shape name' }).first()).toBeFocused()
  await page.keyboard.type('Slot')
  await page.keyboard.press('Enter')
  await expect(row('Slot')).toBeVisible()

  // On empty canvas nothing is selected, so only what needs no selection is offered.
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y, { button: 'right' })
  await expect(selectedRows).toHaveCount(0)
  await expect(menuItem('Paste')).toBeVisible()
  await expect(menuItem('Rename')).toHaveCount(0)
  await expect(menuItem('Delete')).toHaveCount(0)
  await menuItem('Select all').click()
  await expect(row('Bin 1')).toHaveAttribute('aria-pressed', 'true')

  // A drawing tool keeps its clicks: no menu.
  await app.selectTool('Rectangle')
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y, { button: 'right' })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await app.selectTool('Select')

  // With the bin selected, a right-click on its pocket keeps the bin selected: Delete takes
  // the bin and the pocket, not the pocket alone.
  await row('Bin 1').click()
  await page.mouse.click(420, 620, { button: 'right' })
  await expect(selectedRows).toHaveText(/^Bin 1/)
  await menuItem('Copy').click()

  // What was copied is still there after the lists have gone away and come back.
  await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  await page.getByRole('radio', { name: 'Design', exact: true }).click()
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y, { button: 'right' })
  await menuItem('Paste').click()
  await app.expectBinCount(2)
  await app.expectShapeCount(2)

  // After a right-click, an ordinary drag still moves a shape: the menu did not leave the
  // canvas thinking a button was held.
  const file = join(app.dir, 'menu.gfstudio')
  const before = (await app.save(file)).layoutSnapshot.shapes.find((s) => s.groupId !== null)!
  await page.mouse.click(420, 620, { button: 'right' })
  await page.keyboard.press('Escape')
  await app.drag({ x: 420, y: 620 }, { x: 440, y: 640 })
  const after = (await app.save(file)).layoutSnapshot.shapes.find((s) => s.id === before.id)!
  expect(after.x, 'the pocket moved').not.toBe(before.x)

  expect(app.errors, 'no renderer errors').toEqual([])
})

test('the right-click menu changes with what is under it', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const row = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name: new RegExp(`^${name}`) })
  const menuItem = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('menuitem', { name, exact: true })
  const lip = page.getByRole('menuitemcheckbox', { name: 'Stacking lip' })
  const emptyCanvas = { x: 900, y: 250 }
  const file = join(app.dir, 'menu-target.gfstudio')
  /** The bins as saved, with what the menu changes about them. */
  const bins = async (): Promise<
    Array<{ x: number; y: number; width: number; height: number; hasLip: boolean }>
  > => {
    const saved = (await app.save(file)) as unknown as {
      layoutSnapshot: {
        groups: Array<{
          x: number
          y: number
          width: number
          height: number
          metadata: { hasLip: boolean }
        }>
      }
    }
    return saved.layoutSnapshot.groups.map(({ x, y, width, height, metadata }) => ({
      x,
      y,
      width,
      height,
      hasLip: metadata.hasLip
    }))
  }

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)
  const [first] = await bins()

  // ── Empty canvas: a bin where the pointer is, and the view. Nothing that needs a selection.
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y)
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y, { button: 'right' })
  await expect(menuItem('Reset view')).toBeVisible()
  await expect(menuItem('Rename')).toHaveCount(0)
  await expect(menuItem('Cut')).toHaveCount(0)
  await expect(lip).toHaveCount(0)
  await menuItem('Add bin here').click()
  await app.expectBinCount(2)
  const here = (await bins())[1]
  expect({ width: here.width, height: here.height }, 'one grid square').toEqual({
    width: 42,
    height: 42
  })
  // A bin above or left of the origin has a remainder of -0.
  expect(Math.abs(here.x % 42), 'on the grid').toBe(0)
  expect(Math.abs(here.y % 42), 'on the grid').toBe(0)

  // The same square is now taken.
  await page.mouse.click(emptyCanvas.x, emptyCanvas.y, { button: 'right' })
  await expect(lip, 'the right-click selected the new bin').toBeVisible()
  await page.keyboard.press('Escape')

  // ── A bin, from its row: its stacking lip, and an empty bin beside it. No "here".
  await row('Bin 1').click({ button: 'right' })
  await expect(menuItem('Add bin here')).toHaveCount(0)
  await expect(menuItem('Reset view')).toHaveCount(0)
  await expect(lip).toBeChecked()
  await lip.click()
  expect((await bins())[0].hasLip, 'lip turned off').toBe(false)

  await row('Bin 1').click({ button: 'right' })
  await expect(lip).not.toBeChecked()
  await menuItem('Add bin beside').click()
  await app.expectBinCount(3)
  expect((await bins())[2], 'same size, against the right edge, like the bin it is beside').toEqual(
    {
      x: first.x + first.width,
      y: first.y,
      width: first.width,
      height: first.height,
      hasLip: false
    }
  )

  // ── Shapes: align and distribute. Three rectangles of one size, each further right.
  const starts = [
    { x: 700, y: 420 },
    { x: 740, y: 500 },
    { x: 780, y: 580 }
  ]
  for (const start of starts) {
    await app.selectTool('Rectangle')
    await app.drag(start, { x: start.x + 60, y: start.y + 40 })
  }
  await app.expectShapeCount(3)
  const shapeXs = async (): Promise<number[]> =>
    (await app.save(file)).layoutSnapshot.shapes.map((shape) => shape.x)
  const before = await shapeXs()
  expect(new Set(before).size, 'they start apart').toBe(3)

  await row('Rectangle 1').click()
  await row('Rectangle 3').click({ modifiers: ['Shift'] })
  // A right-click on one of the selected shapes keeps all three selected.
  await page.mouse.click(starts[0].x + 30, starts[0].y + 20, { button: 'right' })
  await expect(lip).toHaveCount(0)
  await menuItem('Arrange').hover()
  await expect(menuItem('Distribute vertically')).toBeVisible()
  await menuItem('Align left').click()
  const after = await shapeXs()
  expect(new Set(after.map((x) => Math.round(x * 100))).size, 'left edges line up').toBe(1)
  expect(after[0], 'to the leftmost one').toBeCloseTo(Math.min(...before), 5)

  expect(app.errors, 'no renderer errors').toEqual([])
})
