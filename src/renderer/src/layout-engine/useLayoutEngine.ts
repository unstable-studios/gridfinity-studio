import { useCallback, useContext, useRef, useSyncExternalStore } from 'react'
import type { LayoutEngine } from './interface'
import type { EngineEventMap, ViewportState } from './types'
import type { LayoutEngineContextValue } from './engine-context'
import { LayoutEngineCtx } from './engine-context'

export function useLayoutEngineContext(): LayoutEngineContextValue {
  return useContext(LayoutEngineCtx)
}

export function useLayoutEngine(): LayoutEngine | null {
  const { engine } = useLayoutEngineContext()
  return engine
}

// ─── Reactive state hooks via useSyncExternalStore ─────────────────────────────

interface EngineState {
  selectedIds: string[]
  viewport: ViewportState
}

export function useEngineState(): EngineState {
  const { engine } = useLayoutEngineContext()
  const stateRef = useRef<EngineState>({
    selectedIds: [],
    viewport: { panX: 0, panY: 0, zoom: 1 }
  })

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!engine) return () => {}

      const unsubs: (() => void)[] = []

      const events: (keyof EngineEventMap)[] = [
        'selectionChanged',
        'viewportChanged',
        'shapeMoved',
        'shapeResized',
        'shapeCreated',
        'shapeDeleted',
        'groupChanged',
        'groupMoved'
      ]

      for (const event of events) {
        unsubs.push(engine.on(event, onStoreChange))
      }

      return () => {
        for (const unsub of unsubs) unsub()
      }
    },
    [engine]
  )

  const getSnapshot = useCallback(() => {
    if (!engine) return stateRef.current

    const newState: EngineState = {
      selectedIds: engine.getSelectedIds(),
      viewport: engine.getViewport()
    }

    // Only return a new object if something actually changed
    const prev = stateRef.current
    if (
      prev.selectedIds.length === newState.selectedIds.length &&
      prev.selectedIds.every((id, i) => id === newState.selectedIds[i]) &&
      prev.viewport.panX === newState.viewport.panX &&
      prev.viewport.panY === newState.viewport.panY &&
      prev.viewport.zoom === newState.viewport.zoom
    ) {
      return prev
    }

    stateRef.current = newState
    return newState
  }, [engine])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
