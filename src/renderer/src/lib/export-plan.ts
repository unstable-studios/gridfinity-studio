/**
 * Which bins an export takes, and what the result is called.
 */

interface Identified {
  id: string
}

interface Named extends Identified {
  /** The name the person gave it, if any. */
  name?: string
}

/** The bins an export takes: every bin that has not been unchecked, in the order of `bins`. */
export function checkedBins<Bin extends Identified>(
  bins: Bin[],
  unchecked: Iterable<string>
): Bin[] {
  const left = new Set(unchecked)
  return bins.filter((bin) => !left.has(bin.id))
}

/** What a "check all" box shows for `checked` out of `total` bins. */
export function allCheckedState(checked: number, total: number): boolean | 'indeterminate' {
  if (checked === 0) return false
  return checked >= total ? true : 'indeterminate'
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
