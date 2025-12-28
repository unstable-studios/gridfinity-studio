import Navbar from './components/Navbar'
import { ThemeProvider } from '@/components/ui/theme-provider'
export default function App(): React.JSX.Element {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Navbar />
    </ThemeProvider>
  )
}
