/**
 * Pure-function tests for `findContainingBinGroup` and `findBestBinForShape`.
 *
 * Both helpers consume `LayoutGroup[]` directly (no engine), so these tests
 * exercise the math in isolation from any Fabric/Konva state. The lower-left
 * corner convention is the shared invariant under test:
 *   - group.x = leftmost world x
 *   - group.y = bottommost world y (largest screen-y)
 *   - bin spans x ∈ [x, x+width], y ∈ [y-height, y]
 */
import { describe, it, expect } from 'vitest'
import type { LayoutGroup } from '../types'
import { findContainingBinGroup, findBestBinForShape, type ShapeAABB } from '../containment'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBin(id: string, x: number, y: number, width: number, height: number): LayoutGroup {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    childIds: [],
    style: { fill: '#fff', stroke: '#000', strokeWidth: 1 },
    metadata: {
      widthUnits: 1,
      depthUnits: 1,
      heightUnits: 6,
      hasLip: true
    }
  }
}

/** A non-bin group — no BinMetadata. findContainingBinGroup must ignore these. */
function makeNonBinGroup(id: string, x: number, y: number, width = 100, height = 100): LayoutGroup {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    childIds: [],
    style: { fill: '#fff', stroke: '#000', strokeWidth: 1 }
  }
}

function aabb(minX: number, minY: number, maxX: number, maxY: number): ShapeAABB {
  return { minX, minY, maxX, maxY }
}

// A 100×100 bin with lower-left at (0, 100) → spans x ∈ [0,100], y ∈ [0,100]
const BIN_A = makeBin('bin-a', 0, 100, 100, 100)

// A 100×100 bin with lower-left at (200, 100) → spans x ∈ [200,300], y ∈ [0,100]
// Adjacent to BIN_A horizontally with a gap.
const BIN_B = makeBin('bin-b', 200, 100, 100, 100)

// ─── findContainingBinGroup ─────────────────────────────────────────────────

describe('findContainingBinGroup', () => {
  it('returns null for empty groups list', () => {
    expect(findContainingBinGroup([], 50, 50)).toBeNull()
  })

  it('returns the bin when point is strictly inside', () => {
    expect(findContainingBinGroup([BIN_A], 50, 50)?.id).toBe('bin-a')
  })

  it('treats edges as inside (inclusive AABB)', () => {
    // All four corners of BIN_A
    expect(findContainingBinGroup([BIN_A], 0, 0)?.id).toBe('bin-a') // top-left
    expect(findContainingBinGroup([BIN_A], 100, 0)?.id).toBe('bin-a') // top-right
    expect(findContainingBinGroup([BIN_A], 0, 100)?.id).toBe('bin-a') // bottom-left
    expect(findContainingBinGroup([BIN_A], 100, 100)?.id).toBe('bin-a') // bottom-right
  })

  it('returns null when point is outside all four sides', () => {
    expect(findContainingBinGroup([BIN_A], -1, 50)).toBeNull() // left of left edge
    expect(findContainingBinGroup([BIN_A], 101, 50)).toBeNull() // right of right edge
    expect(findContainingBinGroup([BIN_A], 50, -1)).toBeNull() // above top edge (smaller screen-y)
    expect(findContainingBinGroup([BIN_A], 50, 101)).toBeNull() // below bottom edge
  })

  it('ignores groups that are not bins (missing BinMetadata)', () => {
    const nonBin = makeNonBinGroup('no-meta', 0, 100)
    expect(findContainingBinGroup([nonBin], 50, 50)).toBeNull()
  })

  it('finds the correct bin when multiple non-overlapping bins exist', () => {
    expect(findContainingBinGroup([BIN_A, BIN_B], 50, 50)?.id).toBe('bin-a')
    expect(findContainingBinGroup([BIN_A, BIN_B], 250, 50)?.id).toBe('bin-b')
    expect(findContainingBinGroup([BIN_A, BIN_B], 150, 50)).toBeNull() // gap between
  })

  it('breaks ties between overlapping bins by closest center', () => {
    // Two bins overlap (collision detection should normally prevent this, but
    // the function is defensive). Point near BIN_X's center should pick X.
    const binX = makeBin('x', 0, 100, 100, 100) // center (50, 50)
    const binY = makeBin('y', 50, 100, 100, 100) // center (100, 50)
    // Point (40, 50) is inside both, closer to binX center
    expect(findContainingBinGroup([binX, binY], 40, 50)?.id).toBe('x')
    // Point (110, 50) is inside both (binX.x+width=100, binY.x+width=150),
    // closer to binY center (100, 50)
    expect(findContainingBinGroup([binX, binY], 110, 50)?.id).toBe('y')
  })
})

// ─── findBestBinForShape ────────────────────────────────────────────────────

describe('findBestBinForShape', () => {
  it('returns null for empty groups list', () => {
    expect(findBestBinForShape([], aabb(0, 0, 10, 10))).toBeNull()
  })

  it('returns the bin when shape AABB is fully inside', () => {
    // Shape spans x ∈ [25,75], y ∈ [25,75] — entirely inside BIN_A
    expect(findBestBinForShape([BIN_A], aabb(25, 25, 75, 75))?.id).toBe('bin-a')
  })

  it('returns the bin when shape partially overlaps and centroid is inside', () => {
    // Shape spans x ∈ [50, 150], y ∈ [25,75] — extends past BIN_A's right edge.
    // Centroid is (100, 50) which sits exactly on the bin's right edge — inside
    // by inclusive containment.
    expect(findBestBinForShape([BIN_A], aabb(50, 25, 150, 75))?.id).toBe('bin-a')
  })

  it('returns the bin when shape partially overlaps even if centroid is outside', () => {
    // Regression: centroid-only matching missed shapes drawn on top of a bin
    // when their centroid landed a hair past an edge. Shape spans
    // x ∈ [80, 180], y ∈ [25,75] — centroid at (130, 50) is past BIN_A's right
    // edge, but the shape clearly overlaps the bin. Should still match by area.
    expect(findBestBinForShape([BIN_A], aabb(80, 25, 180, 75))?.id).toBe('bin-a')
  })

  it('returns null when shape AABB is fully outside all bins', () => {
    expect(findBestBinForShape([BIN_A], aabb(200, 200, 250, 250))).toBeNull()
  })

  it('returns null when AABB only touches the bin edge with zero overlap area', () => {
    // Shape's right edge (x=0) just touches BIN_A's left edge (x=0) but the
    // overlap area is zero (a line, not a region). Should not match.
    expect(findBestBinForShape([BIN_A], aabb(-50, 25, 0, 75))).toBeNull()
  })

  it('ignores non-bin groups', () => {
    const nonBin = makeNonBinGroup('no-meta', 0, 100)
    expect(findBestBinForShape([nonBin], aabb(25, 25, 75, 75))).toBeNull()
  })

  it('prefers the bin whose AABB contains the shape centroid over max overlap area', () => {
    // Shape spans x ∈ [80, 220], y ∈ [25,75]. Centroid (150, 50) is in the gap
    // between BIN_A (x ∈ [0,100]) and BIN_B (x ∈ [200,300]) — neither bin's
    // AABB contains the centroid. With BIN_A overlap area = 20×50 = 1000
    // and BIN_B overlap area = 20×50 = 1000, equal. Now bias the shape to
    // overlap more with BIN_A:
    const shape = aabb(50, 25, 220, 75)
    // BIN_A overlap: width = min(100, 220) - max(0, 50) = 50; area = 50×50 = 2500
    // BIN_B overlap: width = min(300, 220) - max(200, 50) = 20; area = 20×50 = 1000
    // Centroid (135, 50) — not in either bin → falls back to max-area, BIN_A.
    expect(findBestBinForShape([BIN_A, BIN_B], shape)?.id).toBe('bin-a')
  })

  it('uses centroid containment as the tiebreaker between overlap candidates', () => {
    // Three bins with binC in the gap between A and B. Shape's centroid lands
    // inside binC, and binC also has the most overlap area, so both signals
    // unambiguously point to binC over BIN_A.
    //   BIN_A:  x ∈ [0,100],   overlap with shape = 50×50 = 2500
    //   binC:   x ∈ [110,190], overlap with shape = 80×50 = 4000  ← winner
    //   BIN_B:  x ∈ [200,300], no overlap
    // Shape centroid (122.5, 50) lies inside binC's AABB.
    const binC = makeBin('c', 110, 100, 80, 100)
    const shape = aabb(50, 25, 195, 75)
    expect(findBestBinForShape([BIN_A, binC, BIN_B], shape)?.id).toBe('c')
  })

  it('breaks centroid-containment ties by distance to bin center', () => {
    // Two overlapping bins (defensive — collision normally prevents). Shape
    // centroid lands in the overlap region. Pick the bin whose center is
    // closer to the centroid.
    const binX = makeBin('x', 0, 100, 100, 100) // center (50, 50)
    const binY = makeBin('y', 50, 100, 100, 100) // center (100, 50)
    // Shape centered at (45, 50): closer to binX center
    const shape = aabb(40, 45, 50, 55)
    expect(findBestBinForShape([binX, binY], shape)?.id).toBe('x')
  })

  it('handles the zero-area shape (degenerate AABB)', () => {
    // A point-shape (minX === maxX, minY === maxY) inside a bin still has
    // zero area. With area > 0 required, it falls through to null even
    // though geometrically the point is inside the bin.
    expect(findBestBinForShape([BIN_A], aabb(50, 50, 50, 50))).toBeNull()
  })
})
