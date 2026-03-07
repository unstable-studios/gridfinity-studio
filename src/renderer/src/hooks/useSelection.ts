import { useState, useCallback, createContext, useContext } from 'react'
import type { Entity } from '../../../shared/types/project'

export type SelectionType = 'entity' | 'bin'

export interface UseSelectionResult {
  selectedIds: Set<string>
  selectionType: SelectionType
  select: (id: string, additive?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  selectAll: (entities: Entity[]) => void
  toggleSelect: (id: string) => void
  isSelected: (id: string) => boolean
  marqueeSelect: (ids: string[]) => void
  selectBin: (id: string, additive?: boolean) => void
}

const SelectionCtx = createContext<UseSelectionResult | null>(null)

export function useSharedSelection(): UseSelectionResult {
  const ctx = useContext(SelectionCtx)
  if (!ctx) {
    throw new Error('useSharedSelection must be used within a SelectionProvider')
  }
  return ctx
}

export { SelectionCtx }

export function useSelection(): UseSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionType, setSelectionType] = useState<SelectionType>('entity')

  const select = useCallback((id: string, additive?: boolean) => {
    setSelectionType((prevType) => {
      if (prevType !== 'entity') {
        // Switching types — start fresh even if additive
        setSelectedIds(new Set([id]))
      } else if (additive) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        })
      } else {
        setSelectedIds(new Set([id]))
      }
      return 'entity'
    })
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectAll = useCallback((entities: Entity[]) => {
    setSelectionType('entity')
    setSelectedIds(new Set(entities.map((e) => e.id)))
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const marqueeSelect = useCallback((ids: string[]) => {
    setSelectionType('entity')
    setSelectedIds(new Set(ids))
  }, [])

  const selectBin = useCallback((id: string, additive?: boolean) => {
    setSelectionType((prevType) => {
      if (prevType !== 'bin') {
        // Switching types — start fresh even if additive
        setSelectedIds(new Set([id]))
      } else if (additive) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        })
      } else {
        setSelectedIds(new Set([id]))
      }
      return 'bin'
    })
  }, [])

  return {
    selectedIds,
    selectionType,
    select,
    deselect,
    clearSelection,
    selectAll,
    toggleSelect,
    isSelected,
    marqueeSelect,
    selectBin
  }
}
