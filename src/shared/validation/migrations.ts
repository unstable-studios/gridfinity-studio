/**
 * Bringing a project file up to the format this version of the app reads.
 *
 * When the file format changes:
 *   1. Raise `CURRENT_SCHEMA_VERSION` in `types/project.ts`.
 *   2. Add an entry to `MIGRATIONS` below, keyed by the version it converts FROM, that
 *      turns a project of that version into the next one.
 *   3. Add a test for it with a project of the old version.
 * A test checks the steps lead from `OLDEST_SUPPORTED_VERSION` to the current version with
 * none left over, so a raised version with no step fails.
 *
 * Raise the version only when the format changes in a way an older app would misread. It
 * is not the app's version: an app that meets a newer file refuses to open it. A step gets
 * the file as it was read, before any checking, so it must cope with missing parts.
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
   * - `invalid`: a step could not convert it, so it is not a sound project of the version it
   *   claims. `detail` says what went wrong.
   */
  | { ok: false; reason: 'too-new' | 'too-old' | 'invalid'; detail?: string }

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

  if (compareVersions(version, current) > 0) return { ok: false, reason: 'too-new' }
  if (compareVersions(version, OLDEST_SUPPORTED_VERSION) < 0)
    return { ok: false, reason: 'too-old' }

  let project = raw as RawProject
  let at = version
  // Versions are compared as numbers throughout: "0.05.0" is 0.5.0.
  while (compareVersions(at, current) !== 0) {
    const step = Object.entries(migrations).find(([from]) => compareVersions(from, at) === 0)?.[1]
    // A version this app reads, with no step forward that moves it on and stops at the
    // current one, is a mistake in the table, not in the file. It fails loudly: telling the
    // person their file is too old would be untrue.
    if (
      !step ||
      !SEMVER.test(step.to) ||
      compareVersions(step.to, at) <= 0 ||
      compareVersions(step.to, current) > 0
    ) {
      throw new Error(`No sound migration from project format ${at} toward ${current}`)
    }
    try {
      // The file has not been checked yet: a step sees whatever was in it.
      project = { ...step.migrate(project), schemaVersion: step.to }
    } catch (err) {
      return {
        ok: false,
        reason: 'invalid',
        detail: `Could not convert from format ${at}: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    at = step.to
  }
  // A file whose version was written another way now carries it the usual way.
  return { ok: true, project: version === current ? raw : { ...project, schemaVersion: current } }
}

/**
 * Whether the steps lead from the oldest format the app reads to the current one, with
 * nothing left over. For the test that guards a format change; it runs no step.
 */
export function migrationPath(
  migrations: Record<string, Migration> = MIGRATIONS,
  current: string = CURRENT_SCHEMA_VERSION
): { complete: boolean; unused: string[] } {
  const used = new Set<string>()
  let at = OLDEST_SUPPORTED_VERSION
  while (at !== current) {
    const step = migrations[at]
    if (!step || used.has(at) || !SEMVER.test(step.to) || compareVersions(step.to, at) <= 0) {
      return { complete: false, unused: Object.keys(migrations).filter((from) => !used.has(from)) }
    }
    used.add(at)
    at = step.to
  }
  return { complete: true, unused: Object.keys(migrations).filter((from) => !used.has(from)) }
}
