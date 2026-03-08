import { createContext, type RefObject } from 'react'
import type { LayoutEngine } from './interface'
import type { EngineType } from './create-engine'

export interface LayoutEngineContextValue {
  engine: LayoutEngine | null
  engineType: EngineType
  setEngineType: (type: EngineType) => void
  containerRef: RefObject<HTMLDivElement | null>
}

export const LayoutEngineCtx = createContext<LayoutEngineContextValue>({
  engine: null,
  engineType: 'fabric',
  setEngineType: () => {},
  containerRef: { current: null }
})
