/**
 * Compute decorative artwork shapes for a Gridfinity bin.
 *
 * These are non-interactive visual elements rendered inside bin groups:
 * magnet holes, screw holes, and the lip-inset boundary. They communicate
 * bin configuration at a glance on the 2D canvas.
 *
 * All positions are in **group-local coordinates** relative to the centroid
 * (matching how both Fabric and Konva position children within groups).
 */

import type { GridfinityConfig } from '../../../shared/types/project'
import type { BinMetadata } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ArtworkCircle {
  cx: number
  cy: number
  radius: number
  kind: 'magnet' | 'screw'
}

export interface ArtworkLipInset {
  /** Inward offset from the bin edge (mm) */
  inset: number
}

export interface BinArtwork {
  circles: ArtworkCircle[]
  lipInset: ArtworkLipInset | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Distance from cell edge to hole center (mm) — from gridfinity spec */
const HOLE_OFFSET = 8

/** Lip inset distance (mm) — from gridfinity spec */
const LIP_INSET = 2.85

// ─── Computation ────────────────────────────────────────────────────────────

/**
 * Compute artwork for a bin group.
 *
 * @param meta - Bin metadata (widthUnits, depthUnits, hasLip)
 * @param config - Global gridfinity config (baseUnit, hole settings)
 * @returns Artwork shapes in group-local coordinates (origin at centroid)
 */
export function computeBinArtwork(meta: BinMetadata, config: GridfinityConfig): BinArtwork {
  const { baseUnit, magnetHoles, screwHoles } = config
  const circles: ArtworkCircle[] = []

  const widthMm = meta.widthUnits * baseUnit
  const depthMm = meta.depthUnits * baseUnit

  // Hole positions: four corners of each grid cell, offset from cell edges.
  // Coordinates relative to centroid (0,0 = center of bin).
  for (let gx = 0; gx < meta.widthUnits; gx++) {
    for (let gy = 0; gy < meta.depthUnits; gy++) {
      const cellLeft = gx * baseUnit - widthMm / 2
      const cellBottom = gy * baseUnit - depthMm / 2

      const corners = [
        { cx: cellLeft + HOLE_OFFSET, cy: cellBottom + HOLE_OFFSET },
        { cx: cellLeft + baseUnit - HOLE_OFFSET, cy: cellBottom + HOLE_OFFSET },
        { cx: cellLeft + HOLE_OFFSET, cy: cellBottom + baseUnit - HOLE_OFFSET },
        { cx: cellLeft + baseUnit - HOLE_OFFSET, cy: cellBottom + baseUnit - HOLE_OFFSET }
      ]

      for (const pos of corners) {
        if (magnetHoles.enabled) {
          circles.push({ cx: pos.cx, cy: pos.cy, radius: magnetHoles.diameter / 2, kind: 'magnet' })
        }
        if (screwHoles.enabled) {
          circles.push({ cx: pos.cx, cy: pos.cy, radius: screwHoles.diameter / 2, kind: 'screw' })
        }
      }
    }
  }

  const lipInset: ArtworkLipInset | null = meta.hasLip ? { inset: LIP_INSET } : null

  return { circles, lipInset }
}
