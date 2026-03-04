import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import Viewport from '@/components/Viewport'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { AppModeCtx } from '@/hooks/useAppMode'
import type { AppMode, ActiveTool } from '@/hooks/useAppMode'

export default function App(): React.JSX.Element {
  const [mode, setMode] = useState<AppMode>('layout')
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppModeCtx.Provider value={{ mode, setMode, activeTool, setActiveTool }}>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <Navbar />
          <div className="flex flex-1 gap-4 overflow-hidden p-4 min-h-0">
            <Sidebar />
            <Viewport />
          </div>
        </div>
      </AppModeCtx.Provider>
    </ThemeProvider>
  )
}
