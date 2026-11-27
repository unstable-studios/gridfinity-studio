import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp, mappingFromDrawnRect } from './app'
import type { Point, SavedGroup, SavedProject, SavedShape } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('resizing a bin with its handle takes in and lets go of pockets', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'resize-handle.gfstudio')
  const panel = page.getByRole('region', { name: 'History' })
  const steps = panel.locator('ol button')
  const binOf = (p: SavedProject): SavedGroup => p.layoutSnapshot.groups[0]
  const pocketOf = (p: SavedProject, id: string): SavedShape =>
    p.layoutSnapshot.shapes.find((s) => s.id === id)!
  const selectBin = async (): Promise<void> => {
    await page.getByRole('button', { name: /^Bin 1/ }).click()
  }

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()
  await app.expectBinCount(1)

  // Calibrate world→screen from a rectangle drawn on empty canvas, far from the bin.
  const calFrom = { x: 820, y: 180 }
  const calTo = { x: 880, y: 230 }
  await app.selectTool('Rectangle')
  await app.drag(calFrom, calTo)
  await app.expectShapeCount(1)
  let saved = await app.save(file)
  const calibration = saved.layoutSnapshot.shapes[0]
  const toScreen = mappingFromDrawnRect(calibration, calFrom, calTo)
  const start = binOf(saved)
  const unit = start.width / 2
  const midY = start.y - start.height / 2
  /** The handle in the middle of the bin's right edge, just outside it as the frame is. */
  const rightHandle = (bin: SavedGroup): Point => {
    const edge = toScreen({ x: bin.x + bin.width, y: bin.y - bin.height / 2 })
    return { x: edge.x + 2, y: edge.y }
  }
  const screenUnit = toScreen({ x: unit, y: 0 }).x - toScreen({ x: 0, y: 0 }).x

  // A loose pocket half a unit to the right of the bin.
  const pFrom = toScreen({ x: start.x + start.width + unit * 0.3, y: midY - unit * 0.2 })
  const pTo = toScreen({ x: start.x + start.width + unit * 0.7, y: midY + unit * 0.2 })
  await app.selectTool('Rectangle')
  await app.drag(pFrom, pTo)
  await app.expectShapeCount(2)
  saved = await app.save(file)
  const pocketId = saved.layoutSnapshot.shapes.find((s) => s.id !== calibration.id)!.id
  expect(pocketOf(saved, pocketId).groupId, 'drawn outside the bin').toBeNull()

  await page.getByRole('button', { name: 'History', exact: true }).click()
  await app.selectTool('Select')

  // Grow the bin one unit to the right with its handle: it takes the pocket in.
  await selectBin()
  const stepsBefore = await steps.count()
  const handle = rightHandle(start)
  await app.drag(handle, { x: handle.x + screenUnit, y: handle.y })
  saved = await app.save(file)
  expect(binOf(saved).width, 'three units wide').toBeCloseTo(unit * 3, 3)
  expect(binOf(saved).x, 'left edge stays').toBeCloseTo(start.x, 3)
  expect(pocketOf(saved, pocketId).groupId, 'the pocket joins the bin').toBe(start.id)
  await expect(steps, 'one step for the resize and the pocket').toHaveCount(stepsBefore + 1)

  // One undo takes back both.
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect(binOf(saved).width, 'undo: two units wide').toBeCloseTo(unit * 2, 3)
  expect(pocketOf(saved, pocketId).groupId, 'undo: the pocket is loose again').toBeNull()
  await app.menu('Edit', /^Redo/)
  saved = await app.save(file)
  expect(pocketOf(saved, pocketId).groupId, 'redo: back in the bin').toBe(start.id)

  // Shrink it back with the handle: the pocket is outside it and leaves it.
  await selectBin()
  const grown = binOf(saved)
  const grownHandle = rightHandle(grown)
  await app.drag(grownHandle, { x: grownHandle.x - screenUnit, y: grownHandle.y })
  saved = await app.save(file)
  expect(binOf(saved).width, 'two units wide again').toBeCloseTo(unit * 2, 3)
  expect(pocketOf(saved, pocketId).groupId, 'the pocket leaves the bin').toBeNull()

  // Drag the bin one unit right, over the pocket. Moving a bin does not take a pocket in.
  const body = toScreen({ x: start.x + unit * 0.5, y: midY })
  await app.drag(body, { x: body.x + screenUnit, y: body.y })
  saved = await app.save(file)
  const moved = binOf(saved)
  expect(moved.x, 'moved one unit').toBeCloseTo(start.x + unit, 3)
  expect(pocketOf(saved, pocketId).groupId, 'still loose under the bin').toBeNull()

  // A click on a handle that changes nothing is not a change: the pocket stays loose.
  await selectBin()
  const countBeforeClick = await steps.count()
  const still = rightHandle(moved)
  await page.mouse.move(still.x, still.y)
  await page.mouse.down()
  await page.mouse.up()
  saved = await app.save(file)
  expect(binOf(saved).width, 'same size').toBeCloseTo(unit * 2, 3)
  expect(pocketOf(saved, pocketId).groupId, 'a click takes nothing in').toBeNull()
  await expect(steps, 'and adds no step').toHaveCount(countBeforeClick)

  // Nor is a click on the size the bin already has, in the sidebar's size grid (its own is
  // the second one while it is selected).
  await selectBin()
  await page.getByRole('button', { name: '2×2', exact: true }).nth(1).click()
  saved = await app.save(file)
  expect(binOf(saved).width, 'same size from the sidebar').toBeCloseTo(unit * 2, 3)
  expect(pocketOf(saved, pocketId).groupId, 'the sidebar takes nothing in').toBeNull()
  await expect(steps, 'and adds no step either').toHaveCount(countBeforeClick)

  expect(app.errors, 'no renderer errors').toEqual([])
})
