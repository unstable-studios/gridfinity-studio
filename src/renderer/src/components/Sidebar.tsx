const navItems = [
  { label: 'Viewport', description: 'Camera, grid, lighting' },
  { label: 'Assets', description: 'Parts and presets' },
  { label: 'Export', description: 'Prepare models for export' }
]

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className="w-72 shrink-0 rounded-xl border border-zinc-300/80 bg-white/80 px-4 py-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <header className="flex items-center justify-between pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Workspace
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Scene controls</p>
        </div>
        <div
          className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.18)]"
          aria-hidden
        />
      </header>

      <div className="space-y-2 pt-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className="w-full rounded-lg border border-transparent bg-zinc-100/80 px-3 py-2 text-left text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-white dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <div className="flex items-center justify-between">
              <span>{item.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                soon
              </span>
            </div>
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </aside>
  )
}
