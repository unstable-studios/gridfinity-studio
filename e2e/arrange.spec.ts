import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StudioApp, mappingFromDrawnRect } from './app'
import type { Point, SavedProject, SavedShape } from './app'

let app: StudioApp

test.afterEach(async () => {
  await app.close()
})

test('align pockets to each other and center one in its bin', async () => {
  app = await StudioApp.launch()
  const { page } = app
  const file = join(app.dir, 'arrange.gfstudio')
  const align = (name: string): ReturnType<typeof page.getByRole> =>
    page.getByRole('button', { name, exact: true })
  const shape = (p: SavedProject, id: string): SavedShape =>
    p.layoutSnapshot.shapes.find((s) => s.id === id)!
  const left = (s: SavedShape): number => s.x - s.width! / 2
  const top = (s: SavedShape): number => s.y - s.height! / 2

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: '2×2', exact: true }).first().click()

  // A bin is selected: nothing to align.
  await expect(page.getByRole('group', { name: 'Align' })).toHaveCount(0)

  // Calibrate world→screen from a rectangle drawn on empty canvas.
  const looseFrom = { x: 820, y: 180 }
  const looseTo = { x: 880, y: 230 }
  await app.selectTool('Rect')
  await app.drag(looseFrom, looseTo)
  let saved = await app.save(file)
  const loose = saved.layoutSnapshot.shapes[0]
  const toScreen = mappingFromDrawnRect(loose, looseFrom, looseTo)
  const bin = saved.layoutSnapshot.groups[0]
  const inBin = (fx: number, fy: number): Point =>
    toScreen({ x: bin.x + bin.width * fx, y: bin.y - bin.height * (1 - fy) })

  // A loose shape on its own has nothing to align to.
  await expect(page.getByRole('group', { name: 'Align' })).toHaveCount(0)

  // Pocket A, in the upper left of the bin. Drawing leaves it selected.
  const aFrom = inBin(0.15, 0.2)
  const aTo = inBin(0.35, 0.3)
  await app.selectTool('Rect')
  await app.drag(aFrom, aTo)
  saved = await app.save(file)
  const aId = saved.layoutSnapshot.shapes.find((s) => s.id !== loose.id)!.id
  const aDrawn = shape(saved, aId)
  expect(aDrawn.groupId).toBe(bin.id)

  // One pocket in a bin: it can be centered, not pushed against an edge.
  await expect(align('Align left')).toBeDisabled()
  await expect(align('Align bottom')).toBeDisabled()
  await align('Center horizontally in bin').click()
  saved = await app.save(file)
  // A grouped shape's saved position is relative to the bin's center.
  expect(shape(saved, aId).x, 'centered horizontally').toBeCloseTo(0, 3)
  expect(shape(saved, aId).y, 'vertical position untouched').toBeCloseTo(aDrawn.y, 3)
  await align('Center vertically in bin').click()
  saved = await app.save(file)
  expect(shape(saved, aId).y, 'centered vertically').toBeCloseTo(0, 3)
  expect(shape(saved, aId).groupId).toBe(bin.id)

  // Each align is one undo step.
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect(shape(saved, aId).x, 'undo keeps the horizontal centering').toBeCloseTo(0, 3)
  expect(shape(saved, aId).y, 'undo reverts the vertical centering').toBeCloseTo(aDrawn.y, 3)
  await app.menu('Edit', /^Redo/)

  // Pocket B, lower right and a different size. Then select both.
  const bFrom = inBin(0.6, 0.65)
  const bTo = inBin(0.9, 0.85)
  await app.selectTool('Rect')
  await app.drag(bFrom, bTo)
  await app.expectShapeCount(3)
  const aAt = inBin(0.5, 0.5)
  await page.keyboard.down('Shift')
  await page.mouse.click(aAt.x, aAt.y)
  await page.keyboard.up('Shift')
  await expect(align('Align left')).toBeEnabled()

  saved = await app.save(file)
  const bId = saved.layoutSnapshot.shapes.find((s) => s.id !== loose.id && s.id !== aId)!.id
  const before = { a: shape(saved, aId), b: shape(saved, bId) }
  expect(top(before.a)).not.toBeCloseTo(top(before.b), 1)

  await align('Align top').click()
  saved = await app.save(file)
  expect(top(shape(saved, aId)), 'tops line up').toBeCloseTo(top(shape(saved, bId)), 3)
  expect(top(shape(saved, aId)), 'at the higher of the two').toBeCloseTo(
    Math.min(top(before.a), top(before.b)),
    3
  )
  expect(shape(saved, aId).x, 'align top leaves x alone').toBeCloseTo(before.a.x, 3)
  expect(shape(saved, bId).x).toBeCloseTo(before.b.x, 3)

  await align('Align left').click()
  saved = await app.save(file)
  expect(left(shape(saved, aId)), 'left edges line up').toBeCloseTo(left(shape(saved, bId)), 3)
  expect(left(shape(saved, aId))).toBeCloseTo(Math.min(left(before.a), left(before.b)), 3)
  expect(saved.layoutSnapshot.groups[0].childIds.sort()).toEqual([aId, bId].sort())

  // Undo takes back the last align only.
  await app.menu('Edit', /^Undo/)
  saved = await app.save(file)
  expect(shape(saved, bId).x, 'undo reverts align left').toBeCloseTo(before.b.x, 3)
  expect(top(shape(saved, aId)), 'and keeps align top').toBeCloseTo(top(shape(saved, bId)), 3)

  expect(app.errors).toEqual([])
})
