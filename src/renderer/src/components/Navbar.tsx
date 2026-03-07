import { useEffect, useCallback, useState } from 'react'
import Logo from './Logo'
import {
  Navbar as NavbarRoot,
  NavbarContent,
  NavbarActions,
  ThemeToggle
} from '@unstable-studios/ui'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarShortcut
} from '@/components/ui/menubar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import PreferencesModal from '@/components/settings/PreferencesModal'
import NewProjectDialog from '@/components/settings/NewProjectDialog'
import { useProject, useUndo } from '@/hooks/useProject'
import { useAppMode } from '@/hooks/useAppMode'
import {
  SquareDashedIcon,
  BoxIcon,
  MousePointerIcon,
  SquareIcon,
  CircleIcon,
  PentagonIcon
} from 'lucide-react'

const GITHUB_REPO = 'https://github.com/unstable-studios/gridfinity-studio'

function useProjectName(): string {
  const filePath = useProject((s) => s.filePath)
  if (!filePath) return 'Untitled Project'
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath
  return fileName.replace(/\.gfstudio$/i, '')
}

function useWindowTitle(): void {
  const projectName = useProjectName()
  const isModified = useProject((s) => s.isModified)

  useEffect(() => {
    const suffix = isModified ? ' *' : ''
    document.title = `Gridfinity Studio — ${projectName}${suffix}`
  }, [projectName, isModified])
}

export default function Navbar(): React.JSX.Element {
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const isModified = useProject((s) => s.isModified)
  const { saveProject, createNewProject } = useProject()

  useWindowTitle()

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
      <NavbarRoot brand={<Logo />} className="relative z-50 max-w-none [&>div]:max-w-none py-2">
        <NavbarContent className="gap-1">
          <AppMenubar
            onOpenPreferences={() => setPrefsOpen(true)}
            onNewProject={() => setNewProjectOpen(true)}
          />
          {isModified && (
            <button
              type="button"
              onClick={() => void saveProject()}
              className="ml-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition"
              title="Save changes (Cmd+S)"
            >
              Unsaved
            </button>
          )}
        </NavbarContent>
        <NavbarActions className="ml-auto gap-2">
          <ViewModeToggle />
          <ToolBar />
          <ThemeToggle />
        </NavbarActions>
      </NavbarRoot>
      <PreferencesModal open={prefsOpen} onOpenChange={setPrefsOpen} />
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreate={(config) => createNewProject(config)}
      />
    </>
  )
}

function AppMenubar({
  onOpenPreferences,
  onNewProject
}: {
  onOpenPreferences: () => void
  onNewProject: () => void
}) {
  const { project, saveProject, saveProjectAs, loadProject, recentProjects, loadRecentProjects } =
    useProject()
  const { undo, redo, canUndo, canRedo } = useUndo()

  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  // File keyboard shortcuts
  const handleFileKeys = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.code === 'KeyN' && !e.shiftKey) {
        e.preventDefault()
        onNewProject()
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
    [onNewProject, loadProject, saveProject, saveProjectAs]
  )

  // Edit keyboard shortcuts
  const handleEditKeys = useCallback(
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
    window.addEventListener('keydown', handleFileKeys)
    window.addEventListener('keydown', handleEditKeys)
    return () => {
      window.removeEventListener('keydown', handleFileKeys)
      window.removeEventListener('keydown', handleEditKeys)
    }
  }, [handleFileKeys, handleEditKeys])

  const hasProject = project !== null

  return (
    <Menubar>
      {/* ── File ── */}
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenubarItem onSelect={onNewProject}>
            New Project
            <MenubarShortcut>Cmd+N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onSelect={() => void loadProject()}>
            Open Project
            <MenubarShortcut>Cmd+O</MenubarShortcut>
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Open Recent</MenubarSubTrigger>
            <MenubarSubContent>
              {recentProjects.length === 0 ? (
                <MenubarItem disabled>No recent projects</MenubarItem>
              ) : (
                recentProjects.map((filePath) => (
                  <MenubarItem key={filePath} onSelect={() => void loadProject(filePath)}>
                    {filePath.split(/[\\/]/).pop() ?? filePath}
                  </MenubarItem>
                ))
              )}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem disabled={!hasProject} onSelect={() => void saveProject()}>
            Save
            <MenubarShortcut>Cmd+S</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!hasProject} onSelect={() => void saveProjectAs()}>
            Save As...
            <MenubarShortcut>Cmd+Shift+S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled>Import...</MenubarItem>
          <MenubarItem disabled>Export...</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── Edit ── */}
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenubarItem disabled={!canUndo} onSelect={() => undo()}>
            Undo
            <MenubarShortcut>Cmd+Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem disabled={!canRedo} onSelect={() => redo()}>
            Redo
            <MenubarShortcut>Cmd+Shift+Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled>Cut</MenubarItem>
          <MenubarItem disabled>Copy</MenubarItem>
          <MenubarItem disabled>Paste</MenubarItem>
          <MenubarItem disabled>Select All</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onSelect={onOpenPreferences}>
            Preferences...
            <MenubarShortcut>Cmd+,</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── Help ── */}
      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenubarItem onSelect={() => window.open(GITHUB_REPO, '_blank')}>
            Documentation
          </MenubarItem>
          <MenubarItem onSelect={() => window.open(`${GITHUB_REPO}/issues/new`, '_blank')}>
            Report a Bug
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem disabled className="opacity-80 cursor-default">
            Version {__APP_VERSION__}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

function ViewModeToggle() {
  const { mode, setMode, setActiveTool } = useAppMode()

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (!value) return
        if (value === 'layout') {
          setMode('layout')
          setActiveTool('select')
        } else {
          setMode('review')
          setActiveTool(null)
        }
      }}
    >
      <ToggleGroupItem value="layout" className="gap-1.5">
        <SquareDashedIcon className="size-3.5" />
        Design
      </ToggleGroupItem>
      <ToggleGroupItem value="review" className="gap-1.5">
        <BoxIcon className="size-3.5" />
        Preview
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function ToolBar() {
  const { mode, activeTool, setActiveTool } = useAppMode()

  const hidden = mode !== 'layout'

  const tools = [
    { id: 'select' as const, label: 'Select', icon: MousePointerIcon },
    { id: 'rectangle' as const, label: 'Rect', icon: SquareIcon },
    { id: 'circle' as const, label: 'Circle', icon: CircleIcon },
    { id: 'polygon' as const, label: 'Polygon', icon: PentagonIcon }
  ]

  return (
    <ToggleGroup
      type="single"
      value={activeTool ?? ''}
      onValueChange={(value) => {
        if (value) setActiveTool(value as typeof activeTool)
      }}
      className={`transition-opacity ${hidden ? 'opacity-0 pointer-events-none' : ''}`}
    >
      {tools.map((tool) => (
        <ToggleGroupItem
          key={tool.id}
          value={tool.id}
          className="gap-1.5 data-[state=on]:bg-blue-600 data-[state=on]:text-white dark:data-[state=on]:bg-blue-600 dark:data-[state=on]:text-white"
        >
          <tool.icon className="size-3.5" />
          {tool.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
