/**
 * Adjustments that have been applied but not yet recorded, such as a burst of
 * scroll-wheel steps on a number field that ends once the wheel goes quiet.
 * Anything that depends on the recorded history being current (undo, redo)
 * finishes them first.
 */

const pending = new Set<() => void>()

/** Register a commit that is waiting to run. Returns a function that withdraws it. */
export function addPendingCommit(commit: () => void): () => void {
  pending.add(commit)
  return () => pending.delete(commit)
}

/** Run every waiting commit now. */
export function flushPendingCommits(): void {
  for (const commit of [...pending]) {
    pending.delete(commit)
    commit()
  }
}
