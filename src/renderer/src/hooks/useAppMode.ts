import { createContext, useContext } from 'react'

export type AppMode = 'layout' | 'review'
export type ActiveTool = 'select' | 'circle' | 'rectangle' | 'polygon' | null

export interface AppModeContext {
  mode: AppMode
  setMode: (mode: AppMode) => void
  activeTool: ActiveTool
  setActiveTool: (tool: ActiveTool) => void
}

export const AppModeCtx = createContext<AppModeContext>({
  mode: 'layout',
  setMode: () => {},
  activeTool: 'select',
  setActiveTool: () => {}
})

export function useAppMode(): AppModeContext {
  return useContext(AppModeCtx)
}
