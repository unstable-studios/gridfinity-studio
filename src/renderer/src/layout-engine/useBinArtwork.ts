/**
 * Hook that renders decorative bin artwork (magnet holes, screw holes, lip
 * boundary) inside bin groups on the layout engine canvas.
 *
 * Watches engine groups and gridfinity config, recomputing artwork when either
 * changes. Artwork is purely visual — non-interactive and non-selectable.
 */

import { useEffect, useRef } from 'react'
import type { LayoutEngine } from './interface'
import type { GroupDecoration } from './types'
import { isBinGroup } from './types'
import { computeBinArtwork } from './bin-artwork'
import type { GridfinityConfig } from '../../../shared/types/project'

// ─── Artwork → Decoration conversion ────────────────────────────────────────

const HOLE_STROKE = 'rgba(202, 138, 4, 0.6)'
const HOLE_FILL = 'rgba(234, 179, 8, 0.08)'
const HOLE_STROKE_WIDTH = 0.75
const HOLE_DASH = [2, 2]

const LIP_STROKE = 'rgba(202, 138, 4, 0.5)'
const LIP_FILL = 'transparent'
const LIP_STROKE_WIDTH = 0.75
const LIP_DASH = [3, 2]

function artworkToDecorations(
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
      stroke: HOLE_STROKE,
      strokeWidth: HOLE_STROKE_WIDTH,
      fill: HOLE_FILL,
      dash: HOLE_DASH
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
      stroke: LIP_STROKE,
      strokeWidth: LIP_STROKE_WIDTH,
      fill: LIP_FILL,
      dash: LIP_DASH
    })
  }

  return decorations
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages bin artwork decorations on the engine canvas.
 *
 * @param engine - The layout engine instance (null when not mounted)
 * @param config - Global gridfinity configuration
 * @param tick - Mutation tick from useEngineState (triggers re-evaluation)
 */
export function useBinArtwork(
  engine: LayoutEngine | null,
  config: GridfinityConfig | undefined,
  tick: number
): void {
  // Per-group cache: only re-render decorations for groups whose key changed
  const prevKeysRef = useRef<Map<string, string>>(new Map())
  const prevEngineRef = useRef<LayoutEngine | null>(null)

  // Clear cache when groups are removed (e.g. during loadSnapshot/undo).
  // loadSnapshot removes all groups then recreates them — without this,
  // the cache sees identical keys and skips re-applying decorations to
  // the new canvas objects.
  useEffect(() => {
    if (!engine) return
    return engine.on('groupChanged', ({ childIds }) => {
      if (childIds.length === 0) {
        prevKeysRef.current = new Map()
      }
    })
  }, [engine])

  useEffect(() => {
    // Reset cache when engine instance changes (e.g., engine switch)
    if (engine !== prevEngineRef.current) {
      prevKeysRef.current = new Map()
      prevEngineRef.current = engine
    }
    if (!engine || !config) return

    const groups = engine.getAllGroups()
    const binGroups = groups.filter(isBinGroup)

    const configKey =
      `bu=${config.baseUnit}` +
      `|mag=${config.magnetHoles.enabled}:${config.magnetHoles.diameter}` +
      `|scr=${config.screwHoles.enabled}:${config.screwHoles.diameter}`

    const nextKeys = new Map<string, string>()

    for (const group of binGroups) {
      const key = `${group.metadata.widthUnits}x${group.metadata.depthUnits}:${group.metadata.hasLip}|${configKey}`
      nextKeys.set(group.id, key)

      if (prevKeysRef.current.get(group.id) === key) continue
      const decorations = artworkToDecorations(group.metadata, config)
      engine.setGroupDecorations(group.id, decorations)
    }

    // Clear decorations for removed groups
    for (const id of prevKeysRef.current.keys()) {
      if (!nextKeys.has(id)) {
        engine.setGroupDecorations(id, [])
      }
    }

    prevKeysRef.current = nextKeys
  }, [engine, config, tick])
}
