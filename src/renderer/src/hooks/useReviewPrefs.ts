import { createContext, useContext } from 'react'

export interface ReviewPrefs {
  debugColors: boolean
  setDebugColors: (v: boolean) => void
  wireframe: boolean
  setWireframe: (v: boolean) => void
}

export const ReviewPrefsCtx = createContext<ReviewPrefs>({
  debugColors: true,
  setDebugColors: () => {},
  wireframe: true,
  setWireframe: () => {}
})

export function useReviewPrefs(): ReviewPrefs {
  return useContext(ReviewPrefsCtx)
}
