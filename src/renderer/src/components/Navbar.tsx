import { useEffect, useCallback } from 'react'
import Logo from './Logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useProject } from '@/hooks/useProject'
import { useUndo } from '@/hooks/useUndo'

export default function Navbar(): React.JSX.Element {
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
  const {
    project,
    saveProject,
    saveProjectAs,
    loadProject,
    createNewProject,
    recentProjects,
    loadRecentProjects
  } = useProject()

  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  const handleNewProject = (): void => {
    createNewProject()
  }

  const handleOpenProject = (): void => {
    void loadProject()
  }

  const handleSave = (): void => {
    void saveProject()
  }

  const handleSaveAs = (): void => {
    void saveProjectAs()
  }

  const handleOpenRecent = (filePath: string): void => {
    void loadProject(filePath)
  }

  const hasProject = project !== null

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadRecentProjects()}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">File</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onSelect={handleNewProject}>New Project</DropdownMenuItem>
        <DropdownMenuItem onSelect={handleOpenProject}>Open Project</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {recentProjects.length === 0 ? (
              <DropdownMenuItem disabled>No recent projects</DropdownMenuItem>
            ) : (
              recentProjects.map((filePath) => (
                <DropdownMenuItem key={filePath} onSelect={() => handleOpenRecent(filePath)}>
                  {filePath.split('/').pop() ?? filePath}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasProject} onSelect={handleSave}>
          Save
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasProject} onSelect={handleSaveAs}>
          Save As...
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Import...</DropdownMenuItem>
        <DropdownMenuItem disabled>Export...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditMenu() {
  const { undo, redo, canUndo, canRedo, lastLabel } = useUndo()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (mod && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    },
    [undo, redo]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const undoLabel = lastLabel ? `Undo ${lastLabel}` : 'Undo'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem disabled={!canUndo} onSelect={undo}>
          {undoLabel}
          <span className="ml-auto text-xs text-zinc-500">Cmd+Z</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canRedo} onSelect={redo}>
          Redo
          <span className="ml-auto text-xs text-zinc-500">Cmd+Shift+Z</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Cut</DropdownMenuItem>
        <DropdownMenuItem disabled>Copy</DropdownMenuItem>
        <DropdownMenuItem disabled>Paste</DropdownMenuItem>
        <DropdownMenuItem disabled>Select All</DropdownMenuItem>
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
