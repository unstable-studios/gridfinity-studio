import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import Viewport from '@/components/Viewport'
import WelcomeScreen from '@/components/WelcomeScreen'
import { ThemeProvider } from '@unstable-studios/ui'
import { AppModeCtx } from '@/hooks/useAppMode'
import { ProjectProvider, useProject } from '@/hooks/useProject'
import { useSelection, SelectionCtx } from '@/hooks/useSelection'
import type { AppMode, ActiveTool } from '@/hooks/useAppMode'

function AppContent(): React.JSX.Element {
  const { project } = useProject()

  if (!project) {
    return <WelcomeScreen />
  }

  return (
    <>
      <Navbar />
      <div className="flex flex-1 gap-4 overflow-hidden p-4 min-h-0">
        <Sidebar />
        <Viewport />
      </div>
    </>
  )
}

const APP_MODE_KEY = 'gfstudio:appMode'

export default function App(): React.JSX.Element {
  const [mode, setMode] = useState<AppMode>(() => {
    return (sessionStorage.getItem(APP_MODE_KEY) as AppMode) ?? 'layout'
  })
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const selection = useSelection()

  useEffect(() => {
    sessionStorage.setItem(APP_MODE_KEY, mode)
  }, [mode])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectProvider>
        <AppModeCtx.Provider value={{ mode, setMode, activeTool, setActiveTool }}>
          <SelectionCtx.Provider value={selection}>
            <div className="flex h-screen flex-col bg-background text-foreground">
              <AppContent />
            </div>
          </SelectionCtx.Provider>
        </AppModeCtx.Provider>
      </ProjectProvider>
    </ThemeProvider>
  )
}
