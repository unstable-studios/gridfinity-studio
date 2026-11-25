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
import { useProject } from '@/hooks/useProject'
import { useProjectName } from '@/hooks/useProjectName'
import { useEditShortcuts } from '@/hooks/useEditCommands'
import { useCloseGuard } from '@/hooks/useCloseGuard'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useAppMode } from '@/hooks/useAppMode'
import { MOD_KEY } from '@/lib/platform'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import type { UpdateState } from '../../../shared/types/updates'
import { updateMenuItems, type UpdateAction } from '@/lib/update-menu'
import { cn } from '@/lib/utils'
import { useExport, useExportChoiceReset } from '@/hooks/useExport'
import ExportMenu from './ExportMenu'
import HelpDialog from './HelpDialog'
import AboutDialog from './AboutDialog'
import {
  SquareDashedIcon,
  BoxIcon,
  MousePointerIcon,
  Grid2x2PlusIcon,
  SquareIcon,
  CircleIcon,
  PentagonIcon
} from 'lucide-react'

const GITHUB_REPO = 'https://github.com/unstable-studios/gridfinity-studio'

function useWindowTitle(): void {
  const projectName = useProjectName()
  const isModified = useProject((s) => s.isModified)

  useEffect(() => {
    const suffix = isModified ? ' *' : ''
    document.title = `${projectName}${suffix} - Gridfinity Studio`
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
      <NavbarRoot
        brand={<Logo />}
        // The UI package's bar is 56px tall by default, sized for a website. 40px fits the tools.
        height="h-10"
        className="relative z-50 max-w-none [&>div]:max-w-none py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
      >
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
              title={`Save (${MOD_KEY}+S)`}
            >
              Unsaved
            </button>
          )}
        </NavbarContent>
        <NavbarActions className="ml-auto gap-2">
          <ViewModeToggle />
          {/* Export takes the tools' place in Preview, so the mode switch does not move. */}
          <div className="relative flex items-center">
            <ToolBar />
            <PreviewActions />
          </div>
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
  // One value at a time: the store's history changes with every edit, which the menus do
  // not need to follow.
  const undo = useUndoRedo((s) => s.undo)
  const redo = useUndoRedo((s) => s.redo)
  const canUndo = useUndoRedo((s) => s.canUndo)
  const canRedo = useUndoRedo((s) => s.canRedo)
  const historyOpen = useUndoRedo((s) => s.historyOpen)
  const { mode } = useAppMode()
  const edit = useEditShortcuts()
  useCloseGuard()
  const { state: updateState, installNow, check: checkForUpdates } = useAppUpdate()
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const updateActions: Record<UpdateAction, () => void> = {
    check: checkForUpdates,
    install: installNow,
    download: () => window.open(`${GITHUB_REPO}/releases/latest`, '_blank')
  }

  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  const { canExport, exportAs } = useExport()
  useExportChoiceReset()

  // File keyboard shortcuts (undo/redo handled by useEngineUndoRedo)
  const handleFileKeys = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      // A value still being typed in a field is stored when the field loses the keyboard.
      // Do that first, so saving includes it.
      if (e.code === 'KeyS' && document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur()
      }
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

  useEffect(() => {
    window.addEventListener('keydown', handleFileKeys)
    return () => window.removeEventListener('keydown', handleFileKeys)
  }, [handleFileKeys])

  const hasProject = project !== null

  return (
    <>
      <Menubar>
        {/* ── File ── */}
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <MenubarItem onSelect={onNewProject}>
              New project
              <MenubarShortcut>{MOD_KEY}+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onSelect={() => void loadProject()}>
              Open project…
              <MenubarShortcut>{MOD_KEY}+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>Open recent</MenubarSubTrigger>
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
              <MenubarShortcut>{MOD_KEY}+S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!hasProject} onSelect={() => void saveProjectAs()}>
              Save as…
              <MenubarShortcut>{MOD_KEY}+Shift+S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled>Import…</MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger disabled={!canExport}>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onSelect={() => void exportAs('stl')}>STL…</MenubarItem>
                <MenubarItem onSelect={() => void exportAs('3mf')}>3MF…</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>

        {/* ── Edit ── */}
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <MenubarItem disabled={!canUndo} onSelect={undo}>
              Undo
              <MenubarShortcut>{MOD_KEY}+Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!canRedo} onSelect={redo}>
              Redo
              <MenubarShortcut>{MOD_KEY}+Shift+Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem
              disabled={mode !== 'layout'}
              onSelect={() => useUndoRedo.setState({ historyOpen: !historyOpen })}
            >
              {historyOpen ? 'Hide history' : 'Show history'}
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled={!edit.canCopy} onSelect={edit.cut}>
              Cut
              <MenubarShortcut>{MOD_KEY}+X</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!edit.canCopy} onSelect={edit.copy}>
              Copy
              <MenubarShortcut>{MOD_KEY}+C</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!edit.canPaste} onSelect={edit.paste}>
              Paste
              <MenubarShortcut>{MOD_KEY}+V</MenubarShortcut>
            </MenubarItem>
            <MenubarItem disabled={!edit.canSelectAll} onSelect={edit.selectAll}>
              Select all
              <MenubarShortcut>{MOD_KEY}+A</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onSelect={onOpenPreferences}>
              Preferences…
              <MenubarShortcut>{MOD_KEY}+,</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* ── Help ── */}
        <MenubarMenu>
          <MenubarTrigger className="relative">
            Help
            <UpdateBadge state={updateState} />
          </MenubarTrigger>
          <MenubarContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <MenubarItem onSelect={() => setHelpOpen(true)}>User guide</MenubarItem>
            <MenubarItem onSelect={() => window.open(GITHUB_REPO, '_blank')}>
              Source code
            </MenubarItem>
            <MenubarItem onSelect={() => window.open(`${GITHUB_REPO}/issues/new`, '_blank')}>
              Report a bug
            </MenubarItem>
            <MenubarItem onSelect={() => setAboutOpen(true)}>About Gridfinity Studio</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled className="opacity-80 cursor-default">
              Version {__APP_VERSION__}
            </MenubarItem>
            <UpdateMenuItems state={updateState} actions={updateActions} />
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        updateState={updateState}
        updateActions={updateActions}
      />
    </>
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
          setMode(value as 'review')
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

function PreviewActions() {
  const { mode } = useAppMode()
  if (mode !== 'review') return null
  return <ExportMenu className="absolute left-0" />
}

function ToolBar() {
  const { mode, activeTool, setActiveTool } = useAppMode()

  const hidden = mode !== 'layout'

  const tools = [
    { id: 'select' as const, label: 'Select', icon: MousePointerIcon },
    { id: 'bin' as const, label: 'Bin', icon: Grid2x2PlusIcon },
    { id: 'rectangle' as const, label: 'Rectangle', icon: SquareIcon },
    { id: 'circle' as const, label: 'Ellipse', icon: CircleIcon },
    { id: 'polygon' as const, label: 'Polygon', icon: PentagonIcon }
  ]

  return (
    <ToggleGroup
      type="single"
      aria-label="Tools"
      // Hidden tools keep their width, so they must not take the keyboard either.
      inert={hidden}
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

// ─── Update status helpers ──────────────────────────────────────────────────

/**
 * Decorative dot on the Help menu trigger when an update is downloading,
 * ready, or errored. Hidden from screen readers — the actual textual status
 * lives inside the menu (UpdateMenuItems) and in an sr-only label here.
 */
function badgeStyle(state: UpdateState): { color: string; srLabel: string } | null {
  switch (state.kind) {
    case 'downloading':
      return { color: 'bg-blue-500', srLabel: 'Update downloading' }
    case 'downloaded':
      return { color: 'bg-green-500', srLabel: 'Update ready to install' }
    case 'error':
      return { color: 'bg-red-500', srLabel: 'Couldn’t update' }
    default:
      return null
  }
}

function UpdateBadge({ state }: { state: UpdateState }): React.JSX.Element | null {
  const style = badgeStyle(state)
  if (!style) return null
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${style.color}`}
      />
      {/* The comma keeps it apart from "Help" when the two are read as one name. */}
      <span className="sr-only">, {style.srLabel}</span>
    </>
  )
}

/** The update lines of the Help menu: where things stand, and what can be done about it. */
function UpdateMenuItems({
  state,
  actions
}: {
  state: UpdateState
  actions: Record<UpdateAction, () => void>
}): React.JSX.Element {
  const tones = {
    good: 'text-green-700 dark:text-green-400 font-medium',
    // A line that only says something is disabled, and a disabled line is dimmed. This one
    // has to be read, so it is not.
    bad: 'text-red-700 dark:text-red-400 data-[disabled]:opacity-100'
  }
  return (
    <>
      {updateMenuItems(state).map(({ label, action, tone }, place) => (
        <MenubarItem
          // By place, not by label: the line stays the same element as its words change, so
          // the keyboard does not lose its place when a check starts.
          key={place}
          disabled={!action}
          className={cn('text-xs', tone && tones[tone])}
          onSelect={
            action
              ? (e) => {
                  // A check keeps the menu open, so its answer is seen where it was asked for.
                  if (action === 'check') e.preventDefault()
                  actions[action]()
                }
              : undefined
          }
        >
          {label}
        </MenubarItem>
      ))}
    </>
  )
}
