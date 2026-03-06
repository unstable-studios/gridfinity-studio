import { useState, useRef, useCallback, useEffect } from 'react'

export interface NumericInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  fineStep?: number
  coarseStep?: number
  suffix?: string
  precision?: number
  label?: string
}

function clamp(v: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && v < min) return min
  if (max !== undefined && v > max) return max
  return v
}

function roundTo(v: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(v * factor) / factor
}

function getStep(
  e: { shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean },
  step: number,
  fineStep: number,
  coarseStep: number
): number {
  if (e.shiftKey) return fineStep
  if (e.ctrlKey || e.metaKey) return coarseStep
  return step
}

export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  fineStep: fineStepProp,
  coarseStep: coarseStepProp,
  suffix,
  precision = 1,
  label
}: NumericInputProps): React.JSX.Element {
  const fineStep = fineStepProp ?? step / 10
  const coarseStep = coarseStepProp ?? step * 10

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    startX: number
    startValue: number
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
  } | null>(null)

  const apply = useCallback(
    (next: number) => {
      const clamped = clamp(roundTo(next, precision), min, max)
      if (clamped !== value) onChange(clamped)
    },
    [onChange, min, max, precision, value]
  )

  // ── Drag-to-scrub on the label area ──────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing) return
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragRef.current = {
        startX: e.clientX,
        startValue: value,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey
      }
    },
    [value, editing]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const s = getStep(
        { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
        step,
        fineStep,
        coarseStep
      )
      const delta = Math.round(dx / 4) * s
      apply(d.startValue + delta)
    },
    [step, fineStep, coarseStep, apply]
  )

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  // ── Click to edit ────────────────────────────────────────────

  const startEditing = useCallback(() => {
    setEditText(value.toFixed(precision))
    setEditing(true)
  }, [value, precision])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitEdit = useCallback(() => {
    setEditing(false)
    const parsed = parseFloat(editText)
    if (!isNaN(parsed)) apply(parsed)
  }, [editText, apply])

  // ── Wheel ────────────────────────────────────────────────────

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const s = getStep(e, step, fineStep, coarseStep)
      const direction = e.deltaY < 0 ? 1 : -1
      apply(value + direction * s)
    },
    [step, fineStep, coarseStep, value, apply]
  )

  // ── Arrow keys ───────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitEdit()
        return
      }
      if (e.key === 'Escape') {
        setEditing(false)
        return
      }
      if (!editing) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const s = getStep(e, step, fineStep, coarseStep)
        const dir = e.key === 'ArrowUp' ? 1 : -1
        const parsed = parseFloat(editText)
        if (!isNaN(parsed)) {
          const next = roundTo(parsed + dir * s, precision)
          setEditText(next.toFixed(precision))
          apply(next)
        }
      }
    },
    [editing, editText, step, fineStep, coarseStep, precision, apply, commitEdit]
  )

  // ── Steppers ─────────────────────────────────────────────────

  const increment = useCallback(
    (e: React.MouseEvent) => {
      const s = getStep(e, step, fineStep, coarseStep)
      apply(value + s)
    },
    [step, fineStep, coarseStep, value, apply]
  )

  const decrement = useCallback(
    (e: React.MouseEvent) => {
      const s = getStep(e, step, fineStep, coarseStep)
      apply(value - s)
    },
    [step, fineStep, coarseStep, value, apply]
  )

  const displayValue = value.toFixed(precision)

  return (
    <div className="flex items-center gap-1 text-xs" onWheel={onWheel}>
      {/* Label / drag area */}
      {label && (
        <span
          className="text-zinc-500 select-none cursor-ew-resize shrink-0"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {label}
        </span>
      )}

      {/* Value area */}
      <div className="relative flex items-center">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="w-16 bg-zinc-800 text-zinc-200 font-mono text-xs text-right rounded px-1 py-0.5 outline-none ring-1 ring-blue-500"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
          />
        ) : (
          <button
            type="button"
            className="w-16 bg-zinc-800/50 text-zinc-300 font-mono text-xs text-right rounded px-1 py-0.5 hover:bg-zinc-700/60 transition cursor-text"
            onClick={startEditing}
          >
            {displayValue}
            {suffix && <span className="text-zinc-500 ml-0.5">{suffix}</span>}
          </button>
        )}

        {/* Stepper arrows */}
        {!editing && (
          <div className="flex flex-col ml-0.5">
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 leading-none px-0.5"
              onClick={increment}
              tabIndex={-1}
              aria-label="Increment"
            >
              <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor">
                <path d="M4 0L8 5H0z" />
              </svg>
            </button>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 leading-none px-0.5"
              onClick={decrement}
              tabIndex={-1}
              aria-label="Decrement"
            >
              <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor">
                <path d="M4 5L0 0h8z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
