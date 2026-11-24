/** Longest name a bin or shape can have. */
export const MAX_NAME_LENGTH = 60

/**
 * The name to store for what was typed, or null to keep the old one: a name can't be empty,
 * and one that did not change is not worth an undo step.
 */
export function nameToStore(typed: string, current: string | undefined): string | null {
  // Cut by whole characters, so an emoji at the limit is not left as half of one.
  const tidy = Array.from(typed.replace(/\s+/g, ' ').trim())
  const name = tidy.slice(0, MAX_NAME_LENGTH).join('').trim()
  if (name === '' || name === current) return null
  return name
}

/**
 * The name stored on a bin or shape, if it has one. A project file edited by hand can hold
 * anything there, so only text counts.
 */
export function storedName(metadata: Record<string, unknown> | undefined): string | undefined {
  const name = metadata?.name
  return typeof name === 'string' && name !== '' ? name : undefined
}
