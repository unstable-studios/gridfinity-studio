import { createContext } from 'react'
import type { LayoutEngine } from './interface'
import type { EngineType } from './create-engine'

export interface LayoutEngineContextValue {
  engine: LayoutEngine | null
  engineType: EngineType
  setEngineType: (type: EngineType) => void
}

export const LayoutEngineCtx = createContext<LayoutEngineContextValue>({
  engine: null,
  engineType: 'fabric',
  setEngineType: () => {}
})
