import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import Viewport from '@/components/Viewport'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { ProjectProvider } from '@/contexts/ProjectContext'

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ProjectProvider>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <Navbar />
          <div className="flex flex-1 gap-4 overflow-hidden p-4 min-h-0">
            <Sidebar />
            <Viewport />
          </div>
        </div>
      </ProjectProvider>
    </ThemeProvider>
  )
}
