/**
 * Finds pockets that come too close to a bin's outer wall.
 *
 * A pocket may cross the wall on purpose, for an open-sided tray, so this is a warning and
 * never stops a bake or an export.
 */
import type { BinMetadata, LayoutGroup, LayoutShape } from '@/layout-engine/types'
import { buildBinParams } from './bin-params'
import {
  LIP_INSET,
  OUTER_CORNER_RADIUS,
  WALL_THICKNESS
} from '../../../shared/gridfinity-dimensions'
import type { GridfinityConfig } from '../../../shared/types/project'
import type { CSGBinParams, PocketSpec } from '../../../shared/types/worker'

/**
 * - `thin-wall`: less than the standard wall is left between the pocket and the outside.
 * - `cuts-lip`: the wall is thick enough, but the pocket cuts into the stacking lip.
 */
export type WallIssue = 'thin-wall' | 'cuts-lip'

type BinOutline = Pick<
  CSGBinParams,
  'widthUnits' | 'depthUnits' | 'baseUnit' | 'tolerance' | 'hasLip'
>

/** Rounding errors in an outline should not turn a pocket drawn on the line into a warning. */
const EPSILON = 1e-4

/**
 * How far inside the bin's outer outline a point is, in mm. Negative when it is outside.
 * The outline is a rectangle with rounded corners, centered on the origin.
 */
function insideBy(x: number, y: number, bin: BinOutline): number {
  const halfWidth = (bin.widthUnits * bin.baseUnit) / 2 - bin.tolerance
  const halfDepth = (bin.depthUnits * bin.baseUnit) / 2 - bin.tolerance
  const radius = Math.min(OUTER_CORNER_RADIUS, halfWidth, halfDepth)
  const qx = Math.abs(x) - (halfWidth - radius)
  const qy = Math.abs(y) - (halfDepth - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return radius - outside - inside
}

/**
 * The material left between a pocket and the outside of its bin at the closest point, in mm.
 * The bin's outline is convex, so the closest point of a pocket is one of its corners.
 */
export function wallLeft(bin: BinOutline, pocket: PocketSpec): number {
  let least = Infinity
  for (let i = 0; i < pocket.vertices.length; i += 2) {
    const x = pocket.posX + pocket.vertices[i]
    const y = pocket.posY + pocket.vertices[i + 1]
    least = Math.min(least, insideBy(x, y, bin))
  }
  // The pocket is cut larger than drawn, by its clearance.
  return least - pocket.clearance
}

export function pocketWallIssue(bin: BinOutline, pocket: PocketSpec): WallIssue | null {
  const left = wallLeft(bin, pocket)
  if (left < WALL_THICKNESS - EPSILON) return 'thin-wall'
  if (bin.hasLip && left < LIP_INSET - EPSILON) return 'cuts-lip'
  return null
}

/** The issue for one shape as it is laid out in its bin, or null when it has none. */
export function shapeWallIssue(
  bin: LayoutGroup & { metadata: BinMetadata },
  shape: LayoutShape,
  config: GridfinityConfig
): WallIssue | null {
  const params = buildBinParams(bin, [shape], config)
  const pocket = params.pockets[0]
  return pocket ? pocketWallIssue(params, pocket) : null
}

/** What the issue means for the printed bin, as a sentence with no subject. */
export function wallIssueText(issue: WallIssue, count = 1): string {
  const plural = count !== 1
  if (issue === 'thin-wall') {
    return `${plural ? 'leave' : 'leaves'} a wall thinner than ${WALL_THICKNESS} mm`
  }
  return `${plural ? 'cut' : 'cuts'} into the stacking lip`
}

/** One warning per kind of issue in a bin, naming the shape when there is only one. */
export function wallWarnings(params: CSGBinParams): string[] {
  const where = params.name ? `${params.name}: ` : ''
  const warnings: string[] = []
  for (const issue of ['thin-wall', 'cuts-lip'] as const) {
    const found = params.pockets.filter((pocket) => pocketWallIssue(params, pocket) === issue)
    if (found.length === 0) continue
    const subject = found.length === 1 ? (found[0].name ?? 'A shape') : `${found.length} shapes`
    warnings.push(`${where}${subject} ${wallIssueText(issue, found.length)}.`)
  }
  return warnings
}
