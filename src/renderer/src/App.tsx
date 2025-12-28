import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import Viewport from '@/components/Viewport'
import { ThemeProvider } from '@/components/ui/theme-provider'

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex h-screen flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex flex-1 gap-4 overflow-hidden p-4 min-h-0">
          <Sidebar />
          <Viewport />
        </div>
      </div>
    </ThemeProvider>
  )
}
