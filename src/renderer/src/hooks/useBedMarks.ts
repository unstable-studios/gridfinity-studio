/**
 * Marks the bins that do not fit the person's print bed on the Design canvas. Mount once,
 * where the canvas is.
 */
import { useEffect } from 'react'
import { isBinGroup } from '@/layout-engine'
import type { LayoutEngine } from '@/layout-engine'
import { tooBigBinIds } from '@/lib/print-bed'
import { DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'
import type { GridfinityConfig } from '../../../shared/types/project'
import { usePrintBed } from './usePrintBed'

/** `tick` changes whenever the layout does, so the marks follow a bin as it is resized. */
export function useBedMarks(
  engine: LayoutEngine | null,
  gridfinity: GridfinityConfig | undefined,
  tick: number
): void {
  const bed = usePrintBed()
  useEffect(() => {
    if (!engine) return
    const config = gridfinity ?? DEFAULT_GRIDFINITY_CONFIG
    engine.setGroupWarnings(tooBigBinIds(engine.getAllGroups().filter(isBinGroup), config, bed))
  }, [engine, gridfinity, tick, bed])
}
