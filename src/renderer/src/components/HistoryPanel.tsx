import { HistoryIcon, XIcon } from 'lucide-react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { cn } from '@/lib/utils'

/** The History button in the corner of the canvas, and the list of steps it opens. */
export default function HistoryPanel(): React.JSX.Element {
  const { labels, current } = useUndoRedo((s) => s.history)
  const goTo = useUndoRedo((s) => s.goTo)
  const open = useUndoRedo((s) => s.historyOpen)
  const setOpen = (historyOpen: boolean): void => useUndoRedo.setState({ historyOpen })

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="absolute bottom-8 right-2 z-20 inline-flex items-center gap-1 rounded border border-zinc-200 bg-white/90 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <HistoryIcon className="size-3" aria-hidden />
        History
      </button>
      {open && (
        <section
          aria-label="History"
          className="absolute bottom-16 right-2 z-20 flex max-h-80 w-60 flex-col rounded-md border border-zinc-200 bg-white text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">History</h2>
            <button
              type="button"
              aria-label="Close history"
              title="Close history"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          </header>
          {/* Newest first. Steps above the current one are the ones redo would bring back. */}
          <ol reversed className="overflow-y-auto p-1">
            {labels
              .map((label, index) => ({ label, index }))
              .reverse()
              .map(({ label, index }) => (
                <li key={index}>
                  <button
                    type="button"
                    aria-current={index === current ? 'step' : undefined}
                    onClick={() => goTo(index)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800',
                      index === current
                        ? 'bg-blue-600 font-medium text-white hover:bg-blue-600 dark:hover:bg-blue-600'
                        : index > current
                          ? 'text-zinc-400 dark:text-zinc-500'
                          : 'text-zinc-700 dark:text-zinc-300'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {index > current && <span className="shrink-0 text-[10px]">Undone</span>}
                  </button>
                </li>
              ))}
          </ol>
        </section>
      )}
    </>
  )
}
