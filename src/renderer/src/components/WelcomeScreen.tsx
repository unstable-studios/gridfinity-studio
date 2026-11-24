import { useEffect } from 'react'
import { Button } from '@unstable-studios/ui'
import { useProject } from '@/hooks/useProject'
import StudioLogo from '../assets/StudioIcon.svg?react'

export default function WelcomeScreen(): React.JSX.Element {
  const { createNewProject, loadProject, recentProjects, loadRecentProjects } = useProject()

  useEffect(() => {
    loadRecentProjects()
  }, [loadRecentProjects])

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-sm">
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
                  className="w-full text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md px-2 py-1.5 transition truncate"
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
