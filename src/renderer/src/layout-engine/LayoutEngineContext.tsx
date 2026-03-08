import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '@unstable-studios/ui'
import { resolveColors } from '@/lib/theme-config'
import type { EngineType } from './create-engine'
import { createLayoutEngine } from './create-engine'
import type { LayoutEngine } from './interface'
import { LayoutEngineCtx } from './engine-context'
// Import adapters to trigger self-registration
import './fabric-engine'
import './konva-engine'

interface LayoutEngineProviderProps {
  children: React.ReactNode
  defaultEngine?: EngineType
  engineType?: EngineType
}

export function LayoutEngineProvider({
  children,
  defaultEngine = 'fabric',
  engineType: controlledType
}: LayoutEngineProviderProps): React.JSX.Element {
  const [engineState, setEngineState] = useState<{
    engine: LayoutEngine | null
    type: EngineType
  }>({ engine: null, type: controlledType ?? defaultEngine })
  const containerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const pendingStateRef = useRef<{
    snapshot: ReturnType<LayoutEngine['toSnapshot']>
    transient: ReturnType<LayoutEngine['getTransientState']>
  } | null>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const newEngine = createLayoutEngine(engineState.type)
    newEngine.mount(container)

    // Apply theme colors
    const colors = resolveColors(resolvedTheme)
    newEngine.setThemeColors({
      background: colors.layoutBg,
      grid: colors.layoutGrid,
      gridOrigin:
        resolvedTheme === 'light' ? 'rgba(100, 100, 120, 0.4)' : 'rgba(113, 113, 122, 0.35)'
    })

    // Derive sidebar inset from measured sidebar element, fallback to 0
    const sidebar = sidebarRef.current
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      newEngine.setViewportInsets({ left: rect.right - containerRect.left })
    }

    // Apply pending state from an engine switch
    const pending = pendingStateRef.current
    if (pending) {
      newEngine.loadSnapshot(pending.snapshot)
      newEngine.setTransientState(pending.transient)
      pendingStateRef.current = null
    }

    setEngineState((prev) => ({ ...prev, engine: newEngine }))

    return () => {
      newEngine.dispose()
      setEngineState((prev) => (prev.engine === newEngine ? { ...prev, engine: null } : prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineState.type])

  // Re-measure sidebar inset when it resizes
  useEffect(() => {
    const sidebar = sidebarRef.current
    const container = containerRef.current
    const engine = engineState.engine
    if (!sidebar || !container || !engine) return

    const observer = new ResizeObserver(() => {
      const rect = sidebar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      engine.setViewportInsets({ left: rect.right - containerRect.left })
    })
    observer.observe(sidebar)
    return () => observer.disconnect()
  }, [engineState.engine])

  // Update theme colors when theme changes
  useEffect(() => {
    if (!engineState.engine) return
    const colors = resolveColors(resolvedTheme)
    engineState.engine.setThemeColors({
      background: colors.layoutBg,
      grid: colors.layoutGrid,
      gridOrigin:
        resolvedTheme === 'light' ? 'rgba(100, 100, 120, 0.4)' : 'rgba(113, 113, 122, 0.35)'
    })
  }, [resolvedTheme, engineState.engine])

  const handleSetEngineType = useCallback((type: EngineType) => {
    setEngineState((prev) => {
      if (!prev.engine || prev.engine.isInteracting()) return prev

      // Capture state before the effect tears down the old engine
      pendingStateRef.current = {
        snapshot: prev.engine.toSnapshot(),
        transient: prev.engine.getTransientState()
      }

      return { ...prev, type }
    })
  }, [])

  // Sync controlled engineType prop with internal state
  useEffect(() => {
    if (controlledType && controlledType !== engineState.type) {
      handleSetEngineType(controlledType)
    }
  }, [controlledType, engineState.type, handleSetEngineType])

  return (
    <LayoutEngineCtx.Provider
      value={{
        engine: engineState.engine,
        engineType: engineState.type,
        setEngineType: handleSetEngineType,
        containerRef,
        sidebarRef
      }}
    >
      {children}
    </LayoutEngineCtx.Provider>
  )
}

/**
 * Renders the canvas mount point. Place this inside the area where you want
 * the engine canvas to appear (e.g. the Viewport component).
 */
export function LayoutEngineCanvas(): React.JSX.Element {
  const { containerRef } = useContext(LayoutEngineCtx)
  return <div ref={containerRef} className="absolute inset-0" />
}
