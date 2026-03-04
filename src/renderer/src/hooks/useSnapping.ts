import { useState, useCallback, useRef } from 'react'
import { resolveSnapTargets, snapToNearest } from '@/lib/snap'
import type { SnapTarget } from '@/lib/snap'

const DEFAULT_THRESHOLD = 5

export interface UseSnappingResult {
  enabled: boolean
  setEnabled: (v: boolean) => void
  snap: (
    cursor: { x: number; y: number },
    gridSize: number,
    entities: Array<{
      type: string
      transform: { position: { x: number; y: number } }
      [key: string]: unknown
    }>
  ) => { x: number; y: number }
  snapTargets: SnapTarget[]
}

export function useSnapping(): UseSnappingResult {
  const [enabled, setEnabled] = useState(true)
  const [snapTargets, setSnapTargets] = useState<SnapTarget[]>([])
  const targetsRef = useRef<SnapTarget[]>([])

  const snap = useCallback(
    (
      cursor: { x: number; y: number },
      gridSize: number,
      entities: Array<{
        type: string
        transform: { position: { x: number; y: number } }
        [key: string]: unknown
      }>
    ): { x: number; y: number } => {
      if (!enabled) {
        return cursor
      }

      const targets = resolveSnapTargets(cursor, gridSize, entities, DEFAULT_THRESHOLD)
      targetsRef.current = targets
      setSnapTargets(targets)

      const snapped = snapToNearest(cursor, targets)
      return snapped ?? cursor
    },
    [enabled]
  )

  return {
    enabled,
    setEnabled,
    snap,
    snapTargets
  }
}
