import type { LayoutGroup, GroupDecoration } from './types'

/**
 * Encapsulates the visual representation of a LayoutGroup in a specific
 * canvas library. Owns the native group node, background rect, and
 * decoration artwork.
 *
 * **Coordinate convention at the boundary:**
 * - Input (LayoutGroup): `x, y` = lower-left corner
 * - Internal: centroid-based (library-native coords)
 * - Output (readPosition): lower-left corner
 *
 * The renderer converts at the boundary so the engine never touches
 * centroid math directly.
 */
export interface GroupRenderer {
  /**
   * Update position, size, style, and/or rotation.
   * `current` is the already-merged LayoutGroup (patch already applied).
   */
  update(patch: Partial<LayoutGroup>, current: LayoutGroup): void

  /** Replace all non-interactive decorations (bin artwork). */
  setDecorations(decorations: GroupDecoration[]): void

  /**
   * Read the native node's current position back as lower-left corner coords.
   * Used by getGroup() to return the canonical LayoutGroup representation.
   */
  readPosition(): { x: number; y: number; rotation: number }

  /**
   * Snap the native group position to the nearest grid point.
   * Snap reference is the lower-left corner.
   */
  snapToGrid(gridSize: number): void

  /** Remove from canvas/layer and clean up all native objects. */
  destroy(): void
}
