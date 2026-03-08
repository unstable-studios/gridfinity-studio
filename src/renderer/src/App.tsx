import { useState, useEffect, useMemo } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import Viewport from '@/components/Viewport'
import WelcomeScreen from '@/components/WelcomeScreen'
import { ThemeProvider } from '@unstable-studios/ui'
import { AppModeCtx, useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import { ReviewPrefsCtx } from '@/hooks/useReviewPrefs'
import { UndoRedoCtx } from '@/hooks/useUndoRedo'
import { LayoutEngineProvider, useLayoutEngineContext, useEngineUndoRedo } from '@/layout-engine'
import type { AppMode, ActiveTool } from '@/hooks/useAppMode'
import type { EngineType } from '@/layout-engine'

function UndoRedoProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { engine } = useLayoutEngineContext()
  const { undo, redo, canUndo, canRedo } = useEngineUndoRedo(engine)
  const value = useMemo(() => ({ undo, redo, canUndo, canRedo }), [undo, redo, canUndo, canRedo])
  return <UndoRedoCtx.Provider value={value}>{children}</UndoRedoCtx.Provider>
}

function AppContent(): React.JSX.Element {
  const { project } = useProject()
  const { engineType } = useAppMode()

  if (!project) {
    return <WelcomeScreen />
  }

  // Always mount the engine provider so state survives mode switches
  return (
    <LayoutEngineProvider engineType={engineType}>
      <UndoRedoProvider>
        {/* Navbar: solid bar at top */}
        <Navbar />
        {/* Canvas fills remaining space; sidebar floats above it */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <Viewport />
          <Sidebar />
        </div>
      </UndoRedoProvider>
    </LayoutEngineProvider>
  )
}

const APP_MODE_KEY = 'gfstudio:appMode'
const ENGINE_TYPE_KEY = 'gfstudio:engineType'
const DEBUG_COLORS_KEY = 'gfstudio:debugColors'
const WIREFRAME_KEY = 'gfstudio:wireframe'

function readBool(key: string, fallback: boolean): boolean {
  const v = sessionStorage.getItem(key)
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

export default function App(): React.JSX.Element {
  const [mode, setMode] = useState<AppMode>(() => {
    return (sessionStorage.getItem(APP_MODE_KEY) as AppMode) ?? 'layout'
  })
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const [engineType, setEngineType] = useState<EngineType>(() => {
    return (sessionStorage.getItem(ENGINE_TYPE_KEY) as EngineType) ?? 'fabric'
  })
  const [debugColors, setDebugColors] = useState(() => readBool(DEBUG_COLORS_KEY, false))
  const [wireframe, setWireframe] = useState(() => readBool(WIREFRAME_KEY, false))
  useEffect(() => {
    sessionStorage.setItem(APP_MODE_KEY, mode)
  }, [mode])
  useEffect(() => {
    sessionStorage.setItem(ENGINE_TYPE_KEY, engineType)
  }, [engineType])
  useEffect(() => {
    sessionStorage.setItem(DEBUG_COLORS_KEY, String(debugColors))
  }, [debugColors])
  useEffect(() => {
    sessionStorage.setItem(WIREFRAME_KEY, String(wireframe))
  }, [wireframe])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppModeCtx.Provider
        value={{ mode, setMode, activeTool, setActiveTool, engineType, setEngineType }}
      >
        <ReviewPrefsCtx.Provider value={{ debugColors, setDebugColors, wireframe, setWireframe }}>
          <div className="flex h-screen flex-col bg-background text-foreground">
            <AppContent />
          </div>
        </ReviewPrefsCtx.Provider>
      </AppModeCtx.Provider>
    </ThemeProvider>
  )
}
