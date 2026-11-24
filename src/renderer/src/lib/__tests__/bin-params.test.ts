import { describe, it, expect } from 'vitest'
import { buildBinParams } from '../bin-params'
import {
  computeDefaultPocketDepth,
  DEFAULT_GRIDFINITY_CONFIG
} from '../../../../shared/types/project'
import type { BinMetadata, LayoutGroup, LayoutShape } from '@/layout-engine/types'

const config = DEFAULT_GRIDFINITY_CONFIG

const bin = {
  id: 'bin',
  x: 0,
  y: 84,
  width: 84,
  height: 84,
  rotation: 0,
  childIds: [],
  metadata: { widthUnits: 2, depthUnits: 2, heightUnits: 4, hasLip: false, name: 'Bin 1' }
} as unknown as LayoutGroup & { metadata: BinMetadata }

const shape = (overrides: Record<string, unknown>): LayoutShape =>
  ({
    id: 's',
    type: 'rect',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    fill: '',
    stroke: '',
    strokeWidth: 1,
    groupId: 'bin',
    ...overrides
  }) as LayoutShape

describe('buildBinParams', () => {
  it('takes the size from the bin and the rest from the project settings', () => {
    expect(buildBinParams(bin, [], config)).toEqual({
      name: 'Bin 1',
      widthUnits: 2,
      depthUnits: 2,
      heightUnits: 4,
      hasLip: false,
      baseUnit: config.baseUnit,
      unitHeight: config.unitHeight,
      tolerance: config.tolerance,
      magnetHoles: config.magnetHoles,
      screwHoles: config.screwHoles,
      pockets: []
    })
  })

  it('puts a shape drawn toward the top of the screen at the back of the bin', () => {
    // In a bin a shape is stored from the bin's center, with y growing down the screen.
    const [pocket] = buildBinParams(bin, [shape({ x: 12, y: -20 })], config).pockets
    expect(pocket.posX).toBe(12)
    expect(pocket.posY).toBe(20)
  })

  it('cuts from the top of the bin', () => {
    const [pocket] = buildBinParams(bin, [shape({})], config).pockets
    expect(pocket.zTop).toBe(4 * config.unitHeight)
  })

  it('uses the default depth and clearance until the shape has its own', () => {
    const [auto] = buildBinParams(bin, [shape({})], config).pockets
    expect(auto.depth).toBe(computeDefaultPocketDepth(4, config.unitHeight))
    expect(auto.clearance).toBe(0.25)

    const own = shape({ metadata: { pocket: { depth: 6, clearance: 0.5 } } })
    const [set] = buildBinParams(bin, [own], config).pockets
    expect(set.depth).toBe(6)
    expect(set.clearance).toBe(0.5)
  })

  it('names each pocket after its shape, so a warning can say which one', () => {
    const named = shape({ metadata: { name: 'Pliers' } })
    const pockets = buildBinParams(bin, [named, shape({})], config).pockets
    expect(pockets.map((pocket) => pocket.name)).toEqual(['Pliers', undefined])
  })

  it('leaves out shapes that cannot be cut', () => {
    const imported = shape({ type: 'meshImport' })
    const tooFew = shape({ type: 'polygon', points: [{ x: 0, y: 0 }] })
    expect(buildBinParams(bin, [imported, tooFew, shape({})], config).pockets).toHaveLength(1)
  })
})
