import type { AppMode, ActiveTool } from '@/hooks/useAppMode'

export interface Shortcut {
  /** The keys or gesture, such as "Shift+click". */
  keys: string
  /** What it does, such as "add to selection". */
  does: string
}

export interface HintEntry {
  text: string
  shortcuts?: Shortcut[]
}

const DESIGN_HINTS: Record<NonNullable<ActiveTool>, HintEntry> = {
  select: {
    text: 'Click to select. Drag to move.',
    shortcuts: [
      { keys: 'Shift+click', does: 'add to selection' },
      { keys: 'Middle-drag', does: 'pan' },
      { keys: 'Scroll', does: 'zoom' }
    ]
  },
  rectangle: {
    text: 'Drag to draw a rectangle.'
  },
  circle: {
    text: 'Drag to draw an ellipse.'
  },
  polygon: {
    text: 'Click to add points. Click the first point to finish.',
    shortcuts: [
      { keys: 'Esc', does: 'cancel' },
      { keys: 'Enter', does: 'finish' }
    ]
  }
}

const PREVIEW_HINT: HintEntry = {
  text: 'Drag to orbit the model.',
  shortcuts: [
    { keys: 'Scroll', does: 'zoom' },
    { keys: 'Right-drag', does: 'pan' }
  ]
}

export function getHint(mode: AppMode, activeTool: ActiveTool): HintEntry {
  if (mode === 'review') return PREVIEW_HINT
  return DESIGN_HINTS[activeTool ?? 'select']
}
