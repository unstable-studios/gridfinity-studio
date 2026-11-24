import { describe, it, expect } from 'vitest'
import {
  MIGRATIONS,
  OLDEST_SUPPORTED_VERSION,
  bringUpToDate,
  migrationPath,
  type Migration
} from '../migrations'
import { CURRENT_SCHEMA_VERSION, createEmptyProject } from '../../types/project'

describe('bringUpToDate', () => {
  it('leaves a project in the current format exactly as it is', () => {
    const project = createEmptyProject()
    const result = bringUpToDate(project)
    expect(result).toEqual({ ok: true, project })
    expect(result.ok && result.project).toBe(project)
  })

  it('does not open a project written by a later version of the app', () => {
    expect(bringUpToDate({ ...createEmptyProject(), schemaVersion: '99.0.0' })).toEqual({
      ok: false,
      reason: 'too-new'
    })
    // Later by any part of the version, not only the first.
    const [major, minor, patch] = CURRENT_SCHEMA_VERSION.split('.').map(Number)
    for (const later of [`${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`]) {
      expect(bringUpToDate({ schemaVersion: later })).toMatchObject({ reason: 'too-new' })
    }
  })

  it('does not open a project from before the oldest format it reads', () => {
    for (const version of ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.4.99']) {
      expect(bringUpToDate({ schemaVersion: version })).toEqual({ ok: false, reason: 'too-old' })
    }
  })

  it('compares versions as numbers, not as text', () => {
    // As text "0.10.0" sorts before "0.5.0".
    expect(bringUpToDate({ schemaVersion: '0.10.0' }, {}, '0.10.0')).toMatchObject({ ok: true })
    expect(bringUpToDate({ schemaVersion: '0.10.0' }, {}, '0.9.0')).toMatchObject({
      reason: 'too-new'
    })
  })

  it('passes on anything that is not a project with a version, for validation to refuse', () => {
    for (const raw of [null, 'text', 5, [], {}, { schemaVersion: 5 }, { schemaVersion: 'new' }]) {
      expect(bringUpToDate(raw)).toEqual({ ok: true, project: raw })
    }
  })

  describe('with steps to run', () => {
    const steps: Record<string, Migration> = {
      '0.5.0': {
        to: '0.6.0',
        migrate: (project) => ({ ...project, addedIn06: true })
      },
      '0.6.0': {
        to: '0.7.0',
        migrate: (project) => ({ ...project, addedIn07: (project.addedIn06 as boolean) && 'yes' })
      }
    }

    it('runs every step from the file’s version to the current one, in order', () => {
      const old = { schemaVersion: '0.5.0', name: 'Kept' }
      expect(bringUpToDate(old, steps, '0.7.0')).toEqual({
        ok: true,
        project: { schemaVersion: '0.7.0', name: 'Kept', addedIn06: true, addedIn07: 'yes' }
      })
      // What was read from the file is not changed.
      expect(old).toEqual({ schemaVersion: '0.5.0', name: 'Kept' })
    })

    it('starts part-way for a file that is part-way', () => {
      expect(bringUpToDate({ schemaVersion: '0.6.0', addedIn06: true }, steps, '0.7.0')).toEqual({
        ok: true,
        project: { schemaVersion: '0.7.0', addedIn06: true, addedIn07: 'yes' }
      })
    })

    it('sets the version itself, whatever a step returns', () => {
      const forgetful: Record<string, Migration> = {
        '0.5.0': { to: '0.6.0', migrate: () => ({ schemaVersion: 'wrong' }) }
      }
      expect(bringUpToDate({ schemaVersion: '0.5.0' }, forgetful, '0.6.0')).toEqual({
        ok: true,
        project: { schemaVersion: '0.6.0' }
      })
    })

    it('fails loudly when the table has no sound way forward', () => {
      // A mistake in the app, not in the file: it must not be reported as an old file.
      const tables: Array<Record<string, Migration>> = [
        { '0.5.0': steps['0.5.0'] }, // stops short of 0.7.0
        { '0.5.0': { to: '0.5.0', migrate: (project) => project } }, // goes nowhere
        { '0.5.0': { to: '0.9.0', migrate: (project) => project } }, // overshoots
        { '0.5.0': { to: 'v0.6.0', migrate: (project) => project } } // not a version
      ]
      for (const table of tables) {
        expect(() => bringUpToDate({ schemaVersion: '0.5.0' }, table, '0.7.0')).toThrow(
          /No sound migration/
        )
      }
    })

    it('calls a file a step cannot convert invalid, and says why', () => {
      const strict: Record<string, Migration> = {
        '0.5.0': {
          to: '0.6.0',
          migrate: (project) => ({
            count: (project.layoutSnapshot as { shapes: unknown[] }).shapes.length
          })
        }
      }
      const result = bringUpToDate({ schemaVersion: '0.5.0' }, strict, '0.6.0')
      expect(result).toMatchObject({ ok: false, reason: 'invalid' })
      expect(!result.ok && result.detail).toMatch(/Could not convert from format 0\.5\.0/)
    })

    it('reads a version written with leading zeros as the version it is', () => {
      expect(bringUpToDate({ schemaVersion: '0.05.0' }, steps, '0.7.0')).toMatchObject({
        ok: true,
        project: { schemaVersion: '0.7.0', addedIn07: 'yes' }
      })
      expect(bringUpToDate({ schemaVersion: '0.07.0' }, steps, '0.7.0')).toEqual({
        ok: true,
        project: { schemaVersion: '0.7.0' }
      })
    })
  })
})

describe('migrationPath', () => {
  const step = (to: string): Migration => ({ to, migrate: (project) => project })

  it('is complete with no steps while the oldest format is the current one', () => {
    expect(migrationPath({}, OLDEST_SUPPORTED_VERSION)).toEqual({ complete: true, unused: [] })
  })

  it('is complete when the steps chain to the current version', () => {
    const table = { '0.5.0': step('0.6.0'), '0.6.0': step('0.7.0') }
    expect(migrationPath(table, '0.7.0')).toEqual({ complete: true, unused: [] })
  })

  it('is not complete when the version was raised and no step was added', () => {
    expect(migrationPath({}, '0.6.0').complete).toBe(false)
    expect(migrationPath({ '0.5.0': step('0.6.0') }, '0.7.0').complete).toBe(false)
  })

  it('names a step that nothing leads to, such as one keyed by the version it makes', () => {
    const misKeyed = { '0.5.0': step('0.6.0'), '0.7.0': step('0.7.0') }
    expect(migrationPath(misKeyed, '0.6.0')).toEqual({ complete: true, unused: ['0.7.0'] })
  })

  it('is not complete when a step goes backward, in circles, or to something not a version', () => {
    expect(migrationPath({ '0.5.0': step('0.4.0') }, '0.6.0').complete).toBe(false)
    expect(migrationPath({ '0.5.0': step('0.5.0') }, '0.6.0').complete).toBe(false)
    expect(migrationPath({ '0.5.0': step('v0.6.0') }, '0.6.0').complete).toBe(false)
  })
})

describe('the steps the app ships with', () => {
  it('lead from the oldest format it reads to the current one, with none left over', () => {
    // Fails when CURRENT_SCHEMA_VERSION is raised without a step being added, or when a
    // step is keyed by the wrong version.
    expect(migrationPath(MIGRATIONS, CURRENT_SCHEMA_VERSION)).toEqual({
      complete: true,
      unused: []
    })
  })
})
