/**
 * Turns a bin and its shapes, as laid out in the editor, into the parameters of the solid.
 */
import type { LayoutGroup, LayoutShape, BinMetadata } from '@/layout-engine/types'
import { shapeToPocketVertices } from './pocket-vertices'
import type { CSGBinParams, PocketSpec } from '../../../shared/types/worker'
import type { GridfinityConfig } from '../../../shared/types/project'
import { computeDefaultPocketDepth } from '../../../shared/types/project'

const DEFAULT_CLEARANCE = 0.25

interface ShapePocketMetadata {
  pocket?: { depth: number; clearance: number }
}

/**
 * What the geometry worker needs to build a bin: its size, the project's Gridfinity settings,
 * and a pocket for each of its shapes that can be cut.
 */
export function buildBinParams(
  bin: LayoutGroup & { metadata: BinMetadata },
  childShapes: LayoutShape[],
  config: GridfinityConfig
): CSGBinParams {
  const totalH = bin.metadata.heightUnits * config.unitHeight
  const pockets: PocketSpec[] = []

  for (const shape of childShapes) {
    const verts = shapeToPocketVertices(shape)
    if (!verts) continue

    const meta = shape.metadata as ShapePocketMetadata | undefined
    const depth =
      meta?.pocket?.depth ?? computeDefaultPocketDepth(bin.metadata.heightUnits, config.unitHeight)
    const clearance = meta?.pocket?.clearance ?? DEFAULT_CLEARANCE

    pockets.push({
      vertices: verts,
      depth,
      clearance,
      // The CSG builder works in math y-up (positive cy = "back" of the bin
      // in slicer convention), but the editor stores shape.y in screen-y-down
      // convention (small y = "top of design"). Flip the Y sign at the
      // boundary so a shape drawn at the top of the design lands at the
      // back of the bin in 3D, not the front. Vertex Y is normalized
      // separately in shapeToPocketVertices.
      posX: shape.x,
      posY: -shape.y,
      zTop: totalH
    })
  }

  return {
    widthUnits: bin.metadata.widthUnits,
    depthUnits: bin.metadata.depthUnits,
    heightUnits: bin.metadata.heightUnits,
    baseUnit: config.baseUnit,
    unitHeight: config.unitHeight,
    tolerance: config.tolerance,
    hasLip: bin.metadata.hasLip,
    magnetHoles: config.magnetHoles,
    screwHoles: config.screwHoles,
    pockets
  }
}
