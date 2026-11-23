import { createContext, type RefObject } from 'react'
import type { LayoutEngine } from './interface'

export interface LayoutEngineContextValue {
  engine: LayoutEngine | null
  containerRef: RefObject<HTMLDivElement | null>
  sidebarRef: RefObject<HTMLDivElement | null>
}

export const LayoutEngineCtx = createContext<LayoutEngineContextValue>({
  engine: null,
  containerRef: { current: null },
  sidebarRef: { current: null }
})
