import { createContext, useContext } from 'react'
import type { EngineType } from '@/layout-engine'

export type AppMode = 'layout' | 'review'
export type ActiveTool = 'select' | 'circle' | 'rectangle' | 'polygon' | null

export interface AppModeContext {
  mode: AppMode
  setMode: (mode: AppMode) => void
  activeTool: ActiveTool
  setActiveTool: (tool: ActiveTool) => void
  engineType: EngineType
  setEngineType: (type: EngineType) => void
}

export const AppModeCtx = createContext<AppModeContext>({
  mode: 'layout',
  setMode: () => {},
  activeTool: 'select',
  setActiveTool: () => {},
  engineType: 'fabric',
  setEngineType: () => {}
})

export function useAppMode(): AppModeContext {
  return useContext(AppModeCtx)
}
