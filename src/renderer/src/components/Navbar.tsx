import { useEffect, useCallback, useState } from 'react'
import Logo from './Logo'
import {
  Navbar as NavbarRoot,
  NavbarContent,
  NavbarActions,
  ThemeToggle
} from '@unstable-studios/ui'
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
import PreferencesModal from '@/components/settings/PreferencesModal'
import { useProject } from '@/hooks/useProject'
import { useUndo } from '@/hooks/useUndo'
import { useAppMode } from '@/hooks/useAppMode'

const GITHUB_REPO = 'https://github.com/unstable-studios/gridfinity-studio'

export default function Navbar(): React.JSX.Element {
  const [prefsOpen, setPrefsOpen] = useState(false)

  // Cmd+, shortcut for preferences
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Comma') {
        e.preventDefault()
        setPrefsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <NavbarRoot brand={<Logo />} className="max-w-none [&>div]:max-w-none">
        <NavbarContent>
          <FileMenu />
          <EditMenu onOpenPreferences={() => setPrefsOpen(true)} />
          <HelpMenu />
        </NavbarContent>
        <NavbarActions className="ml-auto">
          <ViewModeToggle />
          <ToolBar />
          <ThemeToggle />
        </NavbarActions>
      </NavbarRoot>
      <PreferencesModal open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
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

  const hidden = mode !== 'layout'

  const tools = [
    { id: 'select' as const, label: 'Select' },
    { id: 'rectangle' as const, label: 'Rect' },
    { id: 'circle' as const, label: 'Circle' },
    { id: 'polygon' as const, label: 'Polygon' }
  ]

  return (
    <div
      className={`flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden transition-opacity ${
        hidden ? 'opacity-0 pointer-events-none' : ''
      }`}
    >
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

function MenuTrigger({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition rounded-md hover:bg-accent"
    >
      {children}
    </button>
  )
}

function ShortcutLabel({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-xs text-zinc-500">{children}</span>
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.code === 'KeyN' && !e.shiftKey) {
        e.preventDefault()
        createNewProject()
      } else if (e.code === 'KeyO' && !e.shiftKey) {
        e.preventDefault()
        void loadProject()
      } else if (e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault()
        void saveProject()
      } else if (e.code === 'KeyS' && e.shiftKey) {
        e.preventDefault()
        void saveProjectAs()
      }
    },
    [createNewProject, loadProject, saveProject, saveProjectAs]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const hasProject = project !== null

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadRecentProjects()}>
      <DropdownMenuTrigger asChild>
        <MenuTrigger>File</MenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onSelect={() => createNewProject()}>
          New Project
          <ShortcutLabel>Cmd+N</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void loadProject()}>
          Open Project
          <ShortcutLabel>Cmd+O</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Open Recent</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {recentProjects.length === 0 ? (
              <DropdownMenuItem disabled>No recent projects</DropdownMenuItem>
            ) : (
              recentProjects.map((filePath) => (
                <DropdownMenuItem key={filePath} onSelect={() => void loadProject(filePath)}>
                  {filePath.split(/[\\/]/).pop() ?? filePath}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasProject} onSelect={() => void saveProject()}>
          Save
          <ShortcutLabel>Cmd+S</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasProject} onSelect={() => void saveProjectAs()}>
          Save As...
          <ShortcutLabel>Cmd+Shift+S</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Import...</DropdownMenuItem>
        <DropdownMenuItem disabled>Export...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditMenu({ onOpenPreferences }: { onOpenPreferences: () => void }) {
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
        <MenuTrigger>Edit</MenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem disabled={!canUndo} onSelect={undo}>
          {undoLabel}
          <ShortcutLabel>Cmd+Z</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canRedo} onSelect={redo}>
          Redo
          <ShortcutLabel>Cmd+Shift+Z</ShortcutLabel>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Cut</DropdownMenuItem>
        <DropdownMenuItem disabled>Copy</DropdownMenuItem>
        <DropdownMenuItem disabled>Paste</DropdownMenuItem>
        <DropdownMenuItem disabled>Select All</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenPreferences}>
          Preferences...
          <ShortcutLabel>Cmd+,</ShortcutLabel>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTrigger>Help</MenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onSelect={() => window.open(GITHUB_REPO, '_blank')}>
          Documentation
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open(`${GITHUB_REPO}/issues/new`, '_blank')}>
          Report a Bug
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-80 cursor-default">
          Version {__APP_VERSION__}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
