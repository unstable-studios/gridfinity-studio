import { useAppMode } from '@/hooks/useAppMode'
import { getHint } from '@/lib/hints'

export default function HintCard(): React.JSX.Element {
  const { mode, activeTool } = useAppMode()
  const hint = getHint(mode, activeTool)

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 max-w-sm rounded-lg border border-zinc-200/60 bg-white/70 px-3 py-2 text-xs backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/70">
      <p className="text-zinc-700 dark:text-zinc-300">{hint.text}</p>
      {hint.shortcuts && hint.shortcuts.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-500 dark:text-zinc-500">
          {hint.shortcuts.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}
