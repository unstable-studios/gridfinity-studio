/**
 * Bringing a project file up to the format this version of the app reads.
 *
 * When the file format changes:
 *   1. Raise `CURRENT_SCHEMA_VERSION` in `types/project.ts`.
 *   2. Add an entry to `MIGRATIONS` below, keyed by the version it converts FROM, that
 *      turns a project of that version into the next one.
 *   3. Add a test for it with a project of the old version.
 * A test checks there is a step from every version back to `OLDEST_SUPPORTED_VERSION`, so a
 * raised version with no step fails.
 *
 * Files from before `OLDEST_SUPPORTED_VERSION` are not opened. They kept bins and entities
 * in their own lists, and the app that wrote them was never released for general use.
 */
import { CURRENT_SCHEMA_VERSION } from '../types/project'

type RawProject = Record<string, unknown>

/** One step: a project of one version in, the same project as the next version out. */
export interface Migration {
  /** The version the project is once `migrate` has run. */
  to: string
  /** Must not change what it is given. */
  migrate: (project: RawProject) => RawProject
}

/** The first format with a layout snapshot. Nothing earlier is read. */
export const OLDEST_SUPPORTED_VERSION = '0.5.0'

/** Steps by the version they convert from. Empty while only one format has been released. */
export const MIGRATIONS: Record<string, Migration> = {}

export type UpToDate =
  | { ok: true; project: unknown }
  /**
   * - `too-new`: written by a later version of the app.
   * - `too-old`: from before the oldest format this app reads.
   */
  | { ok: false; reason: 'too-new' | 'too-old'; version: string }

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** Negative when `a` is the earlier version, positive when the later, 0 when the same. */
function compareVersions(a: string, b: string): number {
  const [, ...partsA] = SEMVER.exec(a) ?? []
  const [, ...partsB] = SEMVER.exec(b) ?? []
  for (let i = 0; i < 3; i++) {
    const difference = Number(partsA[i]) - Number(partsB[i])
    if (difference !== 0) return difference
  }
  return 0
}

/**
 * Convert a project that was just read from a file to the current format, one step at a
 * time. A project already in the current format comes back as it is.
 *
 * Something that is not a project with a version, such as a file of another kind, also
 * comes back as it is: validation then says what is wrong with it.
 */
export function bringUpToDate(
  raw: unknown,
  migrations: Record<string, Migration> = MIGRATIONS,
  current: string = CURRENT_SCHEMA_VERSION
): UpToDate {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { ok: true, project: raw }
  const version = (raw as RawProject).schemaVersion
  if (typeof version !== 'string' || !SEMVER.test(version)) return { ok: true, project: raw }

  if (compareVersions(version, current) > 0) return { ok: false, reason: 'too-new', version }
  if (compareVersions(version, OLDEST_SUPPORTED_VERSION) < 0) {
    return { ok: false, reason: 'too-old', version }
  }

  let project = raw as RawProject
  // Each step moves to a later version, so this ends. The limit is for a table that does not.
  for (let steps = 0; project.schemaVersion !== current; steps++) {
    const from = project.schemaVersion as string
    const step = migrations[from]
    if (!step || steps > 1000 || compareVersions(step.to, from) <= 0) {
      // A format in the supported range with no way forward is a mistake in the table
      // above, not in the file. It reads as too old rather than opening half converted.
      return { ok: false, reason: 'too-old', version }
    }
    project = { ...step.migrate(project), schemaVersion: step.to }
  }
  return { ok: true, project }
}
