import { create } from 'zustand'
import type { PositionFrame } from '@/layout-engine/position-frame'

interface PositionFrameState {
  /** What shape positions in the sidebar are measured from. */
  frame: PositionFrame
  setFrame: (frame: PositionFrame) => void
}

/** Kept for the session, so it survives switching between Design and Preview. */
export const usePositionFrame = create<PositionFrameState>((set) => ({
  frame: 'canvas',
  setFrame: (frame) => set({ frame })
}))
