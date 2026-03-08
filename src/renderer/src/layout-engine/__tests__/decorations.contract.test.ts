/**
 * @vitest-environment jsdom
 *
 * Contract tests for setGroupDecorations — verifies that both engines
 * correctly render decorations without disturbing group position, size,
 * or children. These enforce the coordinate boundary invariants:
 *
 *   Public API (LayoutGroup) uses lower-left corner (x, y).
 *   Engine internals use centroid-based coords.
 *   Conversion happens at the boundary (createGroup, updateGroup, getGroup).
 *   Decorations are in group-local space (centroid-relative).
 */
import 'vitest-canvas-mock'

globalThis.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { LayoutEngine } from '../interface'
import type { LayoutGroup, GroupDecoration } from '../types'
import { computeBinArtwork } from '../bin-artwork'
import type { GridfinityConfig } from '../../../../shared/types/project'
import { createLayoutEngine } from '../create-engine'
import '../fabric-engine'
import '../konva-engine'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  const div = document.createElement('div')
  Object.defineProperty(div, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(div, 'clientHeight', { value: 600, configurable: true })
  document.body.appendChild(div)
  return div
}

/** A 2×2 bin group at lower-left corner (0, 84) — 84mm wide, 84mm tall */
function makeBinGroup(overrides: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id: 'bin-1',
    x: 0,
    y: 84,
    width: 84,
    height: 84,
    rotation: 0,
    childIds: [],
    style: {
      fill: 'rgba(96, 165, 250, 0.10)',
      stroke: '#60a5fa',
      strokeWidth: 1,
      cornerRadius: 4
    },
    metadata: {
      widthUnits: 2,
      depthUnits: 2,
      heightUnits: 3,
      hasLip: true,
      name: 'Test Bin'
    },
    ...overrides
  }
}

const DEFAULT_CONFIG: GridfinityConfig = {
  baseUnit: 42,
  gridSpacing: 42,
  unitHeight: 7,
  tolerance: 0.5,
  magnetHoles: { enabled: true, diameter: 6.5, depth: 2.4 },
  screwHoles: { enabled: true, diameter: 3, depth: 6 }
}

/** Build decorations the same way useBinArtwork does */
function buildDecorations(
  meta: { widthUnits: number; depthUnits: number; hasLip: boolean },
  config: GridfinityConfig
): GroupDecoration[] {
  const artwork = computeBinArtwork(
    {
      widthUnits: meta.widthUnits,
      depthUnits: meta.depthUnits,
      heightUnits: 0,
      hasLip: meta.hasLip
    },
    config
  )
  const decorations: GroupDecoration[] = []

  for (const circle of artwork.circles) {
    decorations.push({
      type: 'circle',
      cx: circle.cx,
      cy: circle.cy,
      radius: circle.radius,
      stroke: 'rgba(202, 138, 4, 0.6)',
      strokeWidth: 0.75,
      fill: 'rgba(234, 179, 8, 0.08)',
      dash: [2, 2]
    })
  }

  if (artwork.lipInset) {
    const widthMm = meta.widthUnits * config.baseUnit
    const depthMm = meta.depthUnits * config.baseUnit
    const inset = artwork.lipInset.inset
    decorations.push({
      type: 'rect',
      x: -widthMm / 2 + inset,
      y: -depthMm / 2 + inset,
      width: widthMm - inset * 2,
      height: depthMm - inset * 2,
      cornerRadius: 2,
      stroke: 'rgba(202, 138, 4, 0.5)',
      strokeWidth: 0.75,
      fill: 'transparent',
      dash: [3, 2]
    })
  }

  return decorations
}

// ─── Tolerance ─────────────────────────────────────────────────────────────────

/** Coordinate tolerance for floating-point comparisons (sub-pixel) */
const EPSILON = 0.5

// ─── Contract Tests ────────────────────────────────────────────────────────────

const engineTypes = ['fabric', 'konva'] as const

describe.each(engineTypes)('Decoration contract (%s)', (engineType) => {
  let engine: LayoutEngine
  let container: HTMLDivElement

  beforeEach(() => {
    container = makeContainer()
    engine = createLayoutEngine(engineType)
    engine.mount(container)
  })

  afterEach(() => {
    engine.dispose()
    container.remove()
  })

  // ─── D1: Group position/size unchanged after setGroupDecorations ──────────

  it('D1: setGroupDecorations does not change group position or size', () => {
    const group = makeBinGroup()
    engine.createGroup(group)

    const before = engine.getGroup('bin-1')!
    const decorations = buildDecorations(
      { widthUnits: 2, depthUnits: 2, hasLip: true },
      DEFAULT_CONFIG
    )
    engine.setGroupDecorations('bin-1', decorations)

    const after = engine.getGroup('bin-1')!
    expect(after.x).toBeCloseTo(before.x, 1)
    expect(after.y).toBeCloseTo(before.y, 1)
    expect(after.width).toBeCloseTo(before.width, 1)
    expect(after.height).toBeCloseTo(before.height, 1)
  })

  // ─── D2: Repeated setGroupDecorations does not cause drift ────────────────

  it('D2: calling setGroupDecorations 10 times does not cause position drift', () => {
    const group = makeBinGroup()
    engine.createGroup(group)

    const original = engine.getGroup('bin-1')!
    const decorations = buildDecorations(
      { widthUnits: 2, depthUnits: 2, hasLip: true },
      DEFAULT_CONFIG
    )

    for (let i = 0; i < 10; i++) {
      engine.setGroupDecorations('bin-1', decorations)
    }

    const after = engine.getGroup('bin-1')!
    expect(after.x).toBeCloseTo(original.x, 1)
    expect(after.y).toBeCloseTo(original.y, 1)
    expect(after.width).toBeCloseTo(original.width, 1)
    expect(after.height).toBeCloseTo(original.height, 1)
  })

  // ─── D3: Empty decorations array clears without side effects ──────────────

  it('D3: setGroupDecorations([]) clears decorations without changing group', () => {
    const group = makeBinGroup()
    engine.createGroup(group)

    const decorations = buildDecorations(
      { widthUnits: 2, depthUnits: 2, hasLip: true },
      DEFAULT_CONFIG
    )
    engine.setGroupDecorations('bin-1', decorations)
    const before = engine.getGroup('bin-1')!

    engine.setGroupDecorations('bin-1', [])
    const after = engine.getGroup('bin-1')!

    expect(after.x).toBeCloseTo(before.x, 1)
    expect(after.y).toBeCloseTo(before.y, 1)
    expect(after.width).toBeCloseTo(before.width, 1)
    expect(after.height).toBeCloseTo(before.height, 1)
  })

  // ─── D4: updateGroup after decorations preserves both ─────────────────────

  it('D4: updateGroup(resize) after setGroupDecorations does not corrupt position', () => {
    const group = makeBinGroup()
    engine.createGroup(group)
    engine.setGroupDecorations(
      'bin-1',
      buildDecorations({ widthUnits: 2, depthUnits: 2, hasLip: true }, DEFAULT_CONFIG)
    )

    // Resize bin from 2x2 to 3x2
    engine.updateGroup('bin-1', { width: 126 })

    const after = engine.getGroup('bin-1')!
    expect(after.width).toBeCloseTo(126, 1)
    // x (lower-left) should not change when width changes
    expect(after.x).toBeCloseTo(0, 1)
    // y (lower-left) should not change
    expect(after.y).toBeCloseTo(84, 1)
  })

  // ─── D5: setGroupDecorations after updateGroup(resize) preserves position ─

  it('D5: setGroupDecorations after resize preserves group position', () => {
    const group = makeBinGroup()
    engine.createGroup(group)

    // Resize first
    engine.updateGroup('bin-1', { width: 126, height: 126 })
    const afterResize = engine.getGroup('bin-1')!

    // Then add decorations for the new size
    engine.setGroupDecorations(
      'bin-1',
      buildDecorations({ widthUnits: 3, depthUnits: 3, hasLip: true }, DEFAULT_CONFIG)
    )

    const afterDec = engine.getGroup('bin-1')!
    expect(afterDec.x).toBeCloseTo(afterResize.x, 1)
    expect(afterDec.y).toBeCloseTo(afterResize.y, 1)
    expect(afterDec.width).toBeCloseTo(afterResize.width, 1)
    expect(afterDec.height).toBeCloseTo(afterResize.height, 1)
  })

  // ─── D6: Nonexistent group is a no-op ─────────────────────────────────────

  it('D6: setGroupDecorations on nonexistent group does not throw', () => {
    expect(() => {
      engine.setGroupDecorations('does-not-exist', [
        { type: 'circle', cx: 0, cy: 0, radius: 5, stroke: '#000', strokeWidth: 1, fill: '#fff' }
      ])
    }).not.toThrow()
  })
})

// ─── Pure Artwork Tests (no engine) ─────────────────────────────────────────

describe('computeBinArtwork coordinate invariants', () => {
  it('all circles fall within bin bounds (centroid-relative)', () => {
    const meta = { widthUnits: 3, depthUnits: 2, heightUnits: 3, hasLip: true }
    const artwork = computeBinArtwork(meta, DEFAULT_CONFIG)

    const halfW = (meta.widthUnits * DEFAULT_CONFIG.baseUnit) / 2
    const halfH = (meta.depthUnits * DEFAULT_CONFIG.baseUnit) / 2

    for (const c of artwork.circles) {
      expect(c.cx - c.radius).toBeGreaterThanOrEqual(-halfW - EPSILON)
      expect(c.cx + c.radius).toBeLessThanOrEqual(halfW + EPSILON)
      expect(c.cy - c.radius).toBeGreaterThanOrEqual(-halfH - EPSILON)
      expect(c.cy + c.radius).toBeLessThanOrEqual(halfH + EPSILON)
    }
  })

  it('lip inset rect falls within bin bounds', () => {
    const meta = { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true }
    const artwork = computeBinArtwork(meta, DEFAULT_CONFIG)

    expect(artwork.lipInset).not.toBeNull()
    const halfW = (meta.widthUnits * DEFAULT_CONFIG.baseUnit) / 2
    const halfH = (meta.depthUnits * DEFAULT_CONFIG.baseUnit) / 2
    const inset = artwork.lipInset!.inset

    // Lip inset rect should be strictly inside the bin
    expect(inset).toBeGreaterThan(0)
    expect(-halfW + inset).toBeGreaterThan(-halfW)
    expect(-halfH + inset).toBeGreaterThan(-halfH)
  })

  it('no lip produced when hasLip is false', () => {
    const meta = { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: false }
    const artwork = computeBinArtwork(meta, DEFAULT_CONFIG)
    expect(artwork.lipInset).toBeNull()
  })

  it('no circles produced when both hole types disabled', () => {
    const config: GridfinityConfig = {
      ...DEFAULT_CONFIG,
      magnetHoles: { ...DEFAULT_CONFIG.magnetHoles, enabled: false },
      screwHoles: { ...DEFAULT_CONFIG.screwHoles, enabled: false }
    }
    const artwork = computeBinArtwork(
      { widthUnits: 2, depthUnits: 2, heightUnits: 3, hasLip: true },
      config
    )
    expect(artwork.circles).toHaveLength(0)
  })

  it('circle count matches expected for NxM grid with both hole types', () => {
    const meta = { widthUnits: 3, depthUnits: 2, heightUnits: 3, hasLip: true }
    const artwork = computeBinArtwork(meta, DEFAULT_CONFIG)
    // 4 corners per cell × (3×2) cells × 2 hole types = 48
    expect(artwork.circles).toHaveLength(3 * 2 * 4 * 2)
  })
})

// ─── Cross-Engine Decoration Parity ─────────────────────────────────────────

describe('Cross-engine decoration parity', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = makeContainer()
  })

  afterEach(() => {
    container.remove()
  })

  it('group position matches between engines after identical decoration sequence', () => {
    const group = makeBinGroup()
    const decorations = buildDecorations(
      { widthUnits: 2, depthUnits: 2, hasLip: true },
      DEFAULT_CONFIG
    )

    // Run on Fabric
    const fabric = createLayoutEngine('fabric')
    fabric.mount(container)
    fabric.createGroup({ ...group })
    fabric.setGroupDecorations('bin-1', decorations)
    const fabricGroup = fabric.getGroup('bin-1')!
    fabric.dispose()

    // Run on Konva
    const konva = createLayoutEngine('konva')
    konva.mount(container)
    konva.createGroup({ ...group })
    konva.setGroupDecorations('bin-1', decorations)
    const konvaGroup = konva.getGroup('bin-1')!
    konva.dispose()

    expect(fabricGroup.x).toBeCloseTo(konvaGroup.x, 0)
    expect(fabricGroup.y).toBeCloseTo(konvaGroup.y, 0)
    expect(fabricGroup.width).toBeCloseTo(konvaGroup.width, 0)
    expect(fabricGroup.height).toBeCloseTo(konvaGroup.height, 0)
  })

  it('group position matches between engines after resize + decoration', () => {
    const group = makeBinGroup()

    const run = (type: 'fabric' | 'konva'): LayoutGroup => {
      const eng = createLayoutEngine(type)
      eng.mount(container)
      eng.createGroup({ ...group })
      eng.updateGroup('bin-1', { width: 126 })
      eng.setGroupDecorations(
        'bin-1',
        buildDecorations({ widthUnits: 3, depthUnits: 2, hasLip: true }, DEFAULT_CONFIG)
      )
      const result = eng.getGroup('bin-1')!
      eng.dispose()
      return result
    }

    const fabricResult = run('fabric')
    const konvaResult = run('konva')

    expect(fabricResult.x).toBeCloseTo(konvaResult.x, 0)
    expect(fabricResult.y).toBeCloseTo(konvaResult.y, 0)
    expect(fabricResult.width).toBeCloseTo(konvaResult.width, 0)
    expect(fabricResult.height).toBeCloseTo(konvaResult.height, 0)
  })
})
