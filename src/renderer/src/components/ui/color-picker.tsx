import { useState, useRef, useCallback } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Input } from './input'

const STORAGE_KEY = 'gfstudio:recentColors'
const MAX_RECENT = 8

function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function pushRecentColor(color: string): string[] {
  const normalized = color.toLowerCase()
  const recent = loadRecentColors().filter((c) => c !== normalized)
  recent.unshift(normalized)
  const trimmed = recent.slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  return trimmed
}

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
}

export default function ColorPicker({ value, onChange, label }: ColorPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecentColors)
  const [hexInput, setHexInput] = useState(value)
  const prevValueRef = useRef(value)

  // Sync hex input when value prop changes externally
  if (value !== prevValueRef.current) {
    prevValueRef.current = value
    setHexInput(value)
  }

  const handlePickerChange = useCallback(
    (color: string) => {
      setHexInput(color)
      onChange(color)
    },
    [onChange]
  )

  const handleHexCommit = useCallback(
    (hex: string) => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        onChange(hex)
      }
    },
    [onChange]
  )

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && /^#[0-9a-fA-F]{6}$/.test(value)) {
        setRecent(pushRecentColor(value))
      }
      setOpen(isOpen)
    },
    [value]
  )

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={handleClose}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            style={{ backgroundColor: value }}
            aria-label={`Pick color${label ? ` for ${label}` : ''}`}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start" side="right" sideOffset={8}>
          <div className="flex flex-col gap-3">
            <HexColorPicker color={value} onChange={handlePickerChange} />
            <Input
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value)
                handleHexCommit(e.target.value)
              }}
              onBlur={() => handleHexCommit(hexInput)}
              className="font-mono text-xs h-7 px-2"
              spellCheck={false}
            />
            {recent.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1 block">
                  Recent
                </span>
                <div className="flex gap-1 flex-wrap">
                  {recent.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-5 w-5 rounded-sm border border-zinc-300 dark:border-zinc-600 cursor-pointer hover:scale-110 transition-transform focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setHexInput(c)
                        onChange(c)
                      }}
                      aria-label={`Use recent color ${c}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        value={hexInput}
        onChange={(e) => {
          setHexInput(e.target.value)
          handleHexCommit(e.target.value)
        }}
        onBlur={() => handleHexCommit(hexInput)}
        className="w-20 shrink-0 font-mono text-xs h-7 px-1.5"
        spellCheck={false}
      />
      {label && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{label}</span>
      )}
    </div>
  )
}
