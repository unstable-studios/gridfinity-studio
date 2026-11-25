// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import Module from 'manifold-3d'
import { EXAMPLE_PROJECTS } from '../example-projects'
import { buildBinCSG } from '../bin-csg-builder'
import { buildBinParams } from '../bin-params'
import { isBinGroup } from '@/layout-engine/types'
import type { LayoutGroup, LayoutShape } from '@/layout-engine/types'
import { repairProject, validateProject } from '../../../../shared/validation/project-validator'

/**
 * The examples are the first projects many people open, so each must be a valid project and
 * every pocket in it must cut.
 */

let manifold: unknown

beforeAll(async () => {
  const module = await Module()
  module.setup()
  manifold = module
})

describe.each(EXAMPLE_PROJECTS)('the $name example', (example) => {
  const project = example.build()
  const groups = project.layoutSnapshot.groups as unknown as LayoutGroup[]
  const shapes = project.layoutSnapshot.shapes as unknown as LayoutShape[]

  it('is a valid project that needs no repair', () => {
    expect(validateProject(project).errors).toEqual([])
    expect(repairProject(structuredClone(project))).toEqual(project)
    expect(project.settings.name).toBe(example.name)
  })

  it('is built afresh each time, so one opening cannot change the next', () => {
    const again = example.build()
    expect(again.layoutSnapshot).toEqual(project.layoutSnapshot)
    expect(again.layoutSnapshot.shapes[0]).not.toBe(project.layoutSnapshot.shapes[0])
  })

  it('puts every shape in a bin, inside that bin, clear of the stacking lip', () => {
    expect(groups.length).toBeGreaterThan(0)
    expect(shapes.length).toBeGreaterThan(0)
    for (const shape of shapes) {
      const bin = groups.find((group) => group.id === shape.groupId)!
      expect(bin, `${shape.id} has a bin`).toBeDefined()
      expect(bin.childIds).toContain(shape.id)
      const params = buildBinParams(
        bin as Parameters<typeof buildBinParams>[0],
        [shape],
        project.gridfinity
      )
      const { vertices, posX, posY, clearance } = params.pockets[0]
      // 3.1 mm in from the outside clears the lip's 2.85 mm and the pocket's own clearance.
      const halfWidth = bin.width / 2 - project.gridfinity.tolerance - 3.1
      const halfDepth = bin.height / 2 - project.gridfinity.tolerance - 3.1
      for (let i = 0; i < vertices.length; i += 2) {
        expect(Math.abs(posX + vertices[i]) + clearance).toBeLessThanOrEqual(halfWidth + 0.25)
        expect(Math.abs(posY + vertices[i + 1]) + clearance).toBeLessThanOrEqual(halfDepth + 0.25)
      }
    }
  })

  it('keeps bins from overlapping', () => {
    for (const a of groups) {
      for (const b of groups) {
        if (a === b) continue
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y <= b.y - b.height ||
          b.y <= a.y - a.height
        expect(apart, `${a.id} and ${b.id}`).toBe(true)
      }
    }
  })

  it('bakes every bin with every pocket cut', () => {
    for (const bin of groups.filter(isBinGroup)) {
      const children = shapes.filter((shape) => shape.groupId === bin.id)
      const params = buildBinParams(bin, children, project.gridfinity)
      expect(params.pockets).toHaveLength(children.length)
      const result = buildBinCSG(params, manifold)
      expect(result.skippedPockets).toEqual([])
      expect(result.indices.length).toBeGreaterThan(0)
    }
  })
})
