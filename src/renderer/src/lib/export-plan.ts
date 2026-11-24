/**
 * Which bins an export takes, and what the result is called.
 */

/** Export every bin, or only the ones the selection points at. */
export type ExportScope = 'all' | 'selected'

interface Identified {
  id: string
}

interface Named extends Identified {
  /** The name the person gave it, if any. */
  name?: string
}

/**
 * The bins a selection points at: bins that are selected, and bins holding a selected shape.
 * Returned in the order of `bins`.
 */
export function binsInSelection<Bin extends Identified>(
  bins: Bin[],
  shapes: Array<{ id: string; groupId: string | null }>,
  selectedIds: string[]
): Bin[] {
  const picked = new Set(selectedIds)
  for (const shape of shapes) {
    if (shape.groupId !== null && picked.has(shape.id)) picked.add(shape.groupId)
  }
  return bins.filter((bin) => picked.has(bin.id))
}

/**
 * Name for an export holding `chosen` out of `bins`, used for the file and for the object in
 * it: the project when it holds every bin, the bin when it holds one, and otherwise the
 * project with how many bins.
 */
export function exportTitle(projectName: string, bins: Identified[], chosen: Named[]): string {
  if (chosen.length >= bins.length) return projectName
  if (chosen.length === 1) return chosen[0].name ?? 'Bin'
  return `${projectName} - ${chosen.length} bins`
}
