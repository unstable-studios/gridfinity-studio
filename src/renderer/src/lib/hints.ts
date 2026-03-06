import type { AppMode, ActiveTool } from '@/hooks/useAppMode'

export interface HintEntry {
  text: string
  shortcuts?: string[]
}

const DESIGN_HINTS: Record<NonNullable<ActiveTool>, HintEntry> = {
  select: {
    text: 'Click to select, drag to move. Shift+click for multi-select.',
    shortcuts: ['Shift+Click — add to selection', 'Middle-drag — pan', 'Scroll — zoom']
  },
  rectangle: {
    text: 'Click to place a rectangle at the cursor position.',
    shortcuts: ['Esc — cancel']
  },
  circle: {
    text: 'Click to place a circle at the cursor position.',
    shortcuts: ['Esc — cancel']
  },
  polygon: {
    text: 'Click to place vertices. Close the shape to finish.',
    shortcuts: ['Esc — cancel', 'Enter — close shape']
  }
}

const PREVIEW_HINT: HintEntry = {
  text: 'Orbit to inspect the 3D model. Export when ready.',
  shortcuts: ['Left-drag — orbit', 'Scroll — zoom', 'Middle-drag — pan']
}

export function getHint(mode: AppMode, activeTool: ActiveTool): HintEntry {
  if (mode === 'review') return PREVIEW_HINT
  return DESIGN_HINTS[activeTool ?? 'select']
}
