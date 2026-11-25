/**
 * A pocket's depth, as it is kept on a shape.
 */

/**
 * `metadata` with the pocket cut `depth` mm deep, or as deep as its bin allows for null:
 * then no depth is kept, so the pocket follows the bin if its height changes.
 */
export function withPocketDepth(
  metadata: Record<string, unknown> | undefined,
  depth: number | null
): Record<string, unknown> {
  const pocket = (metadata?.pocket as { clearance?: number } | undefined) ?? {}
  return {
    ...metadata,
    pocket: { clearance: pocket.clearance ?? 0.25, ...(depth === null ? {} : { depth }) }
  }
}
