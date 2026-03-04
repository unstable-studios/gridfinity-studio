import { useAppMode } from '@/hooks/useAppMode'
import { useProject } from '@/hooks/useProject'
import LayoutCanvas from './layout/LayoutCanvas'
import ReviewCanvas from './review/ReviewCanvas'

export default function Viewport(): React.JSX.Element {
  const { mode } = useAppMode()
  const { project } = useProject()

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-linear-to-b from-zinc-100/50 via-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-900 dark:to-zinc-900/70">
      {mode === 'layout' ? (
        <LayoutCanvas
          entities={project?.entities ?? []}
          baseUnit={project?.gridfinity.baseUnit ?? 42}
        />
      ) : (
        <ReviewCanvas />
      )}
    </div>
  )
}
