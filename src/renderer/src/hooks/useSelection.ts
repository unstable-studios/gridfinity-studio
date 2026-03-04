import { useState, useCallback } from 'react'
import type { Entity } from '../../../shared/types/project'

export interface UseSelectionResult {
  selectedIds: Set<string>
  select: (id: string, additive?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  selectAll: (entities: Entity[]) => void
  toggleSelect: (id: string) => void
  isSelected: (id: string) => boolean
  marqueeSelect: (ids: string[]) => void
}

export function useSelection(): UseSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const select = useCallback((id: string, additive?: boolean) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev)
        next.add(id)
        return next
      }
      return new Set([id])
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
    setSelectedIds(new Set(ids))
  }, [])

  return {
    selectedIds,
    select,
    deselect,
    clearSelection,
    selectAll,
    toggleSelect,
    isSelected,
    marqueeSelect
  }
}
