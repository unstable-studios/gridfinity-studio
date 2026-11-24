/** Longest name a bin or shape can have. */
export const MAX_NAME_LENGTH = 60

/**
 * The name to store for what was typed, or null to keep the old one: a name can't be empty,
 * and one that did not change is not worth an undo step.
 */
export function nameToStore(typed: string, current: string | undefined): string | null {
  const name = typed.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim()
  if (name === '' || name === current) return null
  return name
}
