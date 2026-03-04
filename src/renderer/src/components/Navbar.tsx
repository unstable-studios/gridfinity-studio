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
import { useAppMode } from '@/hooks/useAppMode'

export default function Navbar(): React.JSX.Element {
  return (
    <div className="h-16 w-full border-b gap-4 border-zinc-300 flex items-center justify-between px-4 shadow-sm bg-white dark:bg-zinc-800 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <Logo />
        <FileMenu />
        <EditMenu />
        <HelpMenu />
      </div>
      <div className="flex items-center gap-2">
        <ViewModeToggle />
        <ToolBar />
        <ModeToggle />
      </div>
    </div>
  )
}

function ViewModeToggle() {
  const { mode, setMode, setActiveTool } = useAppMode()

  return (
    <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
      <button
        type="button"
        className={`px-3 py-1.5 text-xs font-medium transition ${
          mode === 'layout'
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
        onClick={() => {
          setMode('layout')
          setActiveTool('select')
        }}
      >
        Layout
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 text-xs font-medium transition ${
          mode === 'review'
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
        onClick={() => {
          setMode('review')
          setActiveTool(null)
        }}
      >
        Review
      </button>
    </div>
  )
}

function ToolBar() {
  const { mode, activeTool, setActiveTool } = useAppMode()

  if (mode !== 'layout') return null

  const tools = [
    { id: 'select' as const, label: 'Select' },
    { id: 'rectangle' as const, label: 'Rect' },
    { id: 'circle' as const, label: 'Circle' },
    { id: 'polygon' as const, label: 'Polygon' }
  ]

  return (
    <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={`px-3 py-1.5 text-xs font-medium transition ${
            activeTool === tool.id
              ? 'bg-blue-600 text-white'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          onClick={() => setActiveTool(tool.id)}
        >
          {tool.label}
        </button>
      ))}
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
                  {filePath.split(/[\\/]/).pop() ?? filePath}
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
      if (mod && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && e.code === 'KeyZ' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (mod && e.code === 'KeyY') {
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
