import { useState, useCallback } from 'react'

interface GridPickerProps {
  width: number
  depth: number
  maxWidth?: number
  maxDepth?: number
  onChange: (width: number, depth: number) => void
}

export function GridPicker({
  width,
  depth,
  maxWidth = 6,
  maxDepth = 6,
  onChange
}: GridPickerProps): React.JSX.Element {
  const [hoverW, setHoverW] = useState<number | null>(null)
  const [hoverD, setHoverD] = useState<number | null>(null)

  const handleMouseLeave = useCallback(() => {
    setHoverW(null)
    setHoverD(null)
  }, [])

  const displayW = hoverW ?? width
  const displayD = hoverD ?? depth

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-zinc-500 text-center">
        {displayW}×{displayD}
      </p>
      <div
        className="inline-grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${maxWidth}, 1fr)` }}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: maxDepth }, (_, d) =>
          Array.from({ length: maxWidth }, (_, w) => {
            const col = w + 1
            const row = d + 1
            const isHighlighted = col <= displayW && row <= displayD
            const isActive = col <= width && row <= depth
            return (
              <button
                key={`${col}-${row}`}
                type="button"
                className={`size-4 rounded-[2px] border transition-colors ${
                  isHighlighted
                    ? isActive && hoverW === null
                      ? 'bg-blue-500/40 border-blue-500/60'
                      : 'bg-blue-500/25 border-blue-400/50'
                    : 'bg-zinc-200/60 border-zinc-300/60 dark:bg-zinc-800/60 dark:border-zinc-700/60'
                }`}
                onMouseEnter={() => {
                  setHoverW(col)
                  setHoverD(row)
                }}
                aria-label={`${col}×${row}`}
                onClick={() => onChange(col, row)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
