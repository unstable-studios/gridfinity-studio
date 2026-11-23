import { useContext, useEffect, useRef, useState } from 'react'
import { useTheme } from '@unstable-studios/ui'
import { resolveColors } from '@/lib/theme-config'
import { useProject } from '@/hooks/useProject'
import { createLayoutEngine } from './create-engine'
import type { LayoutEngine } from './interface'
import { LayoutEngineCtx } from './engine-context'
import { GestureRecognizer } from './gesture-recognizer'
import { DEFAULT_GRIDFINITY_CONFIG } from '../../../shared/types/project'

export function LayoutEngineProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [engine, setEngine] = useState<LayoutEngine | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<GestureRecognizer | null>(null)
  const { resolvedTheme } = useTheme()
  const unitHeight = useProject(
    (s) => s.project?.gridfinity.unitHeight ?? DEFAULT_GRIDFINITY_CONFIG.unitHeight
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const newEngine = createLayoutEngine()
    newEngine.mount(container)

    // Apply theme colors
    const colors = resolveColors(resolvedTheme)
    newEngine.setThemeColors({
      background: colors.layoutBg,
      grid: colors.layoutGrid,
      gridOrigin:
        resolvedTheme === 'light' ? 'rgba(100, 100, 120, 0.4)' : 'rgba(113, 113, 122, 0.35)'
    })

    // Sync unitHeight so depth-based shape opacity reflects the project config.
    newEngine.setUnitHeight(unitHeight)

    // Derive sidebar inset from measured sidebar element, fallback to 0
    const sidebar = sidebarRef.current
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      newEngine.setViewportInsets({ left: rect.right - containerRect.left })
    }

    // Initialize or update GestureRecognizer
    if (!gestureRef.current) {
      gestureRef.current = new GestureRecognizer()
      gestureRef.current.attach(container)
    }
    gestureRef.current.setActionHandler(newEngine)

    setEngine(newEngine)

    return () => {
      newEngine.dispose()
      if (gestureRef.current) {
        gestureRef.current.dispose()
        gestureRef.current = null
      }
      setEngine((prev) => (prev === newEngine ? null : prev))
    }
    // Mount once; theme and unit height are pushed by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-measure sidebar inset when it resizes
  useEffect(() => {
    const sidebar = sidebarRef.current
    const container = containerRef.current
    if (!sidebar || !container || !engine) return

    const observer = new ResizeObserver(() => {
      const rect = sidebar.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      engine.setViewportInsets({ left: rect.right - containerRect.left })
    })
    observer.observe(sidebar)
    return () => observer.disconnect()
  }, [engine])

  // Update theme colors when theme changes
  useEffect(() => {
    if (!engine) return
    const colors = resolveColors(resolvedTheme)
    engine.setThemeColors({
      background: colors.layoutBg,
      grid: colors.layoutGrid,
      gridOrigin:
        resolvedTheme === 'light' ? 'rgba(100, 100, 120, 0.4)' : 'rgba(113, 113, 122, 0.35)'
    })
  }, [resolvedTheme, engine])

  // Push unitHeight changes (rare — only when the user changes Gridfinity
  // preset/config) into the engine so depth-based opacity stays accurate.
  useEffect(() => {
    engine?.setUnitHeight(unitHeight)
  }, [unitHeight, engine])

  return (
    <LayoutEngineCtx.Provider
      value={{
        engine,
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
