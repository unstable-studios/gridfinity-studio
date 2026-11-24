import { useEffect } from 'react'
import { Button } from '@unstable-studios/ui'
import { useProject } from '@/hooks/useProject'
import { EXAMPLE_PROJECTS } from '@/lib/example-projects'
import StudioLogo from '../assets/StudioIcon.svg?react'

const LIST_ROW_CLASS =
  'w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'

export default function WelcomeScreen(): React.JSX.Element {
  const { createNewProject, loadProject, openExample, recentProjects, loadRecentProjects } =
    useProject()

  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  return (
    // In a short window the list of recent projects can be taller than the space: it scrolls.
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      {/* Auto margins center it, and still let the top be reached when it does not fit. */}
      <div className="m-auto flex max-w-sm flex-col items-center gap-8 py-6">
        <div className="flex flex-col items-center gap-2">
          <StudioLogo className="h-16 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">Gridfinity Studio</h1>
          <p className="text-sm text-zinc-500 text-center">
            Design Gridfinity bins and export them for printing.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Button className="w-full" onClick={() => createNewProject()}>
            New project
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void loadProject()}>
            Open project…
          </Button>
        </div>

        <div className="w-full">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-2">
            Examples
          </p>
          <div className="space-y-1">
            {EXAMPLE_PROJECTS.map((example) => (
              <button
                key={example.id}
                type="button"
                className={LIST_ROW_CLASS}
                onClick={() => openExample(example)}
              >
                <span className="font-medium">{example.name}</span>
                <span className="ml-2 opacity-70">{example.description}</span>
              </button>
            ))}
          </div>
        </div>

        {recentProjects.length > 0 && (
          <div className="w-full">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-2">
              Recent projects
            </p>
            <div className="space-y-1">
              {recentProjects.map((filePath) => (
                <button
                  key={filePath}
                  type="button"
                  className={LIST_ROW_CLASS}
                  onClick={() => void loadProject(filePath)}
                >
                  {filePath.split(/[\\/]/).pop() ?? filePath}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
