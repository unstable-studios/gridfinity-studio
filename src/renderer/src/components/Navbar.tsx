import Logo from './Logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useProjectContext } from '@/contexts/ProjectContext'
import { useEffect } from 'react'

export default function Navbar(): React.JSX.Element {
  const { error, clearError } = useProjectContext()

  // Show error alerts
  useEffect(() => {
    if (error) {
      alert(error)
      clearError()
    }
  }, [error, clearError])

  return (
    <div className="h-16 w-full border-b gap-4 border-zinc-300 flex items-center justify-between px-4 shadow-sm bg-white dark:bg-zinc-800 dark:border-zinc-700">
      <Logo />
      <div className="flex items-center gap-2">
        <FileMenu />
        <EditMenu />
        <HelpMenu />
        <ModeToggle />
      </div>
    </div>
  )
}

function FileMenu() {
  const { createNewProject, openProject, saveProject, saveProjectAs, project } =
    useProjectContext()

  const handleNewProject = () => {
    createNewProject()
  }

  const handleOpenProject = async () => {
    await openProject()
  }

  const handleSave = async () => {
    await saveProject()
  }

  const handleSaveAs = async () => {
    await saveProjectAs()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">File</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onClick={handleNewProject}>New Project</DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenProject}>Open Project</DropdownMenuItem>
        <DropdownMenuItem disabled>Open Recent...</DropdownMenuItem>
        <DropdownMenuItem onClick={handleSave} disabled={!project}>
          Save
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveAs} disabled={!project}>
          Save As...
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Import...</DropdownMenuItem>
        <DropdownMenuItem disabled>Export...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>Undo</DropdownMenuItem>
        <DropdownMenuItem>Redo</DropdownMenuItem>
        <DropdownMenuItem>Cut</DropdownMenuItem>
        <DropdownMenuItem>Copy</DropdownMenuItem>
        <DropdownMenuItem>Paste</DropdownMenuItem>
        <DropdownMenuItem>Select All</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Help</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>Documentation</DropdownMenuItem>
        <DropdownMenuItem>Community Forums</DropdownMenuItem>
        <DropdownMenuItem>Report a Bug</DropdownMenuItem>
        <DropdownMenuItem>About</DropdownMenuItem>
        <DropdownMenuItem disabled className="opacity-80 cursor-default">
          Version {__APP_VERSION__}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
