// @vitest-environment node
import { describe, expect, it } from 'vitest'
import Module from 'manifold-3d'
import { buildBinCSG } from '../bin-csg-builder'
import type { CSGBinParams } from '../bin-csg-builder'

/**
 * The geometry worker keeps one Manifold module for as long as the app is open, and every
 * visit to Preview bakes every bin again. A bake must give back what it took: before it
 * did, a module failed with "memory access out of bounds" after about 700 bakes of this bin.
 */

const params: CSGBinParams = {
  widthUnits: 2,
  depthUnits: 1,
  heightUnits: 3,
  baseUnit: 42,
  unitHeight: 7,
  tolerance: 0.5,
  hasLip: true,
  magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
  screwHoles: { enabled: true, diameter: 3, depth: 6 },
  pockets: [
    {
      vertices: new Float32Array([-10, -6, 10, -6, 10, 6, -10, 6]),
      depth: 8,
      clearance: 0.25,
      posX: 0,
      posY: 0,
      zTop: 21
    }
  ]
}

interface Handle {
  isDeleted(): boolean
}

function isHandle(value: unknown): value is Handle {
  return (
    typeof value === 'object' && value !== null && typeof (value as Handle).isDeleted === 'function'
  )
}

type Functions = Record<string, (...args: unknown[]) => unknown>

/**
 * A fresh Manifold module that notes every solid and outline made through it: by a static
 * such as `Manifold.hull`, by a method such as `translate`, or by `new CrossSection`.
 */
async function recordingModule(): Promise<{ module: unknown; made: Handle[] }> {
  const module = (await Module()) as unknown as {
    setup(): void
    Manifold: Functions & { prototype: Functions }
    CrossSection: Functions & { prototype: Functions }
  }
  module.setup()
  const made: Handle[] = []
  const noting = (owner: Functions, name: string): void => {
    const original = owner[name]
    owner[name] = function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args)
      if (isHandle(result)) made.push(result)
      return result
    }
  }
  // Methods can sit anywhere up the chain, so each object in it is gone through once.
  const done = new Set<object>()
  const stops = new Set<object>([Object.prototype, Function.prototype])
  for (const kind of [module.Manifold, module.CrossSection]) {
    for (const start of [kind, kind.prototype]) {
      for (
        let owner: Functions | null = start;
        owner && !stops.has(owner) && !done.has(owner);
        owner = Object.getPrototypeOf(owner)
      ) {
        done.add(owner)
        for (const name of Object.getOwnPropertyNames(owner)) {
          const skip = ['constructor', 'prototype', 'delete', 'isDeleted', 'deleteLater', 'clone']
          const { value, writable } = Object.getOwnPropertyDescriptor(owner, name) ?? {}
          if (!skip.includes(name) && typeof value === 'function' && writable) noting(owner, name)
        }
      }
    }
  }
  const CrossSection = new Proxy(module.CrossSection as unknown as new () => Handle, {
    construct(target, args) {
      const outline = Reflect.construct(target, args) as Handle
      made.push(outline)
      return outline
    }
  })
  // The module's own functions and lists, which the builder also calls.
  const inner = module as unknown as Functions
  const recorded: Functions = {}
  for (const name of Object.getOwnPropertyNames(inner)) {
    if (typeof inner[name] !== 'function') continue
    if (name.startsWith('_')) {
      recorded[name] = (...args: unknown[]) => {
        const result = inner[name](...args)
        if (isHandle(result)) made.push(result)
        return result
      }
    } else if (name.startsWith('Vector')) {
      recorded[name] = new Proxy(inner[name] as unknown as new () => Handle, {
        construct(target, args) {
          const list = Reflect.construct(target, args) as Handle
          made.push(list)
          return list
        }
      }) as unknown as Functions[string]
    }
  }
  return { module: { ...module, ...recorded, CrossSection }, made }
}

describe('a bake', () => {
  it('frees every solid and outline it made', async () => {
    const { module, made } = await recordingModule()
    const mesh = buildBinCSG(params, module)

    // Feet, trunk, lip groove, holes and a pocket: a real bake makes dozens.
    expect(made.length).toBeGreaterThan(40)
    // The point lists are made by the builder, where they can be freed, and not inside the
    // library, where this test could not see them.
    const lists = made.filter((item) => item.constructor.name.startsWith('Vector'))
    expect(lists.length).toBeGreaterThanOrEqual(4)
    expect(made.filter((item) => !item.isDeleted())).toHaveLength(0)
    // The mesh was copied out first.
    expect(mesh.indices.length).toBeGreaterThan(0)
    expect(Number.isFinite(mesh.positions[0])).toBe(true)
  })

  it('frees what it made when it fails part-way', async () => {
    const { module, made } = await recordingModule()
    // Cutting the lip groove fails: the feet, the trunk and the groove are made by then.
    const { Manifold } = module as { Manifold: { difference: () => never } }
    Manifold.difference = () => {
      throw new Error('could not cut')
    }

    expect(() => buildBinCSG(params, module)).toThrow('could not cut')
    expect(made.length).toBeGreaterThan(10)
    expect(made.filter((item) => !item.isDeleted())).toHaveLength(0)
  })

  it('can be followed by another on the same module', async () => {
    const { module, made } = await recordingModule()
    const first = buildBinCSG(params, module)
    const second = buildBinCSG(params, module)

    expect(second.positions).toEqual(first.positions)
    expect(made.filter((item) => !item.isDeleted())).toHaveLength(0)
  })
})
