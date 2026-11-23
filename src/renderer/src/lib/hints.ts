import type { AppMode, ActiveTool } from '@/hooks/useAppMode'

export interface HintEntry {
  text: string
  shortcuts?: string[]
}

const DESIGN_HINTS: Record<NonNullable<ActiveTool>, HintEntry> = {
  select: {
    text: 'Click to select. Drag to move.',
    shortcuts: ['Shift+click — add to selection', 'Middle-drag — pan', 'Scroll — zoom']
  },
  rectangle: {
    text: 'Drag to draw a rectangle.'
  },
  circle: {
    text: 'Drag to draw a circle.'
  },
  polygon: {
    text: 'Click to add points. Click the first point to finish.',
    shortcuts: ['Esc — cancel', 'Enter — finish']
  }
}

const PREVIEW_HINT: HintEntry = {
  text: 'Drag to orbit the model.',
  shortcuts: ['Scroll — zoom', 'Right-drag — pan']
}

export function getHint(mode: AppMode, activeTool: ActiveTool): HintEntry {
  if (mode === 'review') return PREVIEW_HINT
  return DESIGN_HINTS[activeTool ?? 'select']
}
