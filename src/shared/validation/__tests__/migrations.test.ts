import { describe, it, expect } from 'vitest'
import { MIGRATIONS, OLDEST_SUPPORTED_VERSION, bringUpToDate, type Migration } from '../migrations'
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
      reason: 'too-new',
      version: '99.0.0'
    })
    // Later by any part of the version, not only the first.
    const [major, minor, patch] = CURRENT_SCHEMA_VERSION.split('.').map(Number)
    for (const later of [`${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`]) {
      expect(bringUpToDate({ schemaVersion: later })).toMatchObject({ reason: 'too-new' })
    }
  })

  it('does not open a project from before the oldest format it reads', () => {
    for (const version of ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.4.99']) {
      expect(bringUpToDate({ schemaVersion: version })).toEqual({
        ok: false,
        reason: 'too-old',
        version
      })
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

    it('refuses, and does not hang or half convert, when a step is missing or goes nowhere', () => {
      const missing = { '0.5.0': steps['0.5.0'] }
      expect(bringUpToDate({ schemaVersion: '0.5.0' }, missing, '0.7.0')).toMatchObject({
        ok: false
      })
      const circular: Record<string, Migration> = {
        '0.5.0': { to: '0.5.0', migrate: (project) => project }
      }
      expect(bringUpToDate({ schemaVersion: '0.5.0' }, circular, '0.7.0')).toMatchObject({
        ok: false
      })
    })
  })
})

describe('the steps the app ships with', () => {
  it('lead from the oldest format it reads to the current one', () => {
    // Fails when CURRENT_SCHEMA_VERSION is raised without a step being added.
    expect(bringUpToDate({ schemaVersion: OLDEST_SUPPORTED_VERSION })).toMatchObject({ ok: true })
    const result = bringUpToDate({ schemaVersion: OLDEST_SUPPORTED_VERSION })
    expect(result.ok && (result.project as { schemaVersion: string }).schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    )
  })

  it('each move forward', () => {
    for (const [from, step] of Object.entries(MIGRATIONS)) {
      expect(
        bringUpToDate({ schemaVersion: step.to }, {}, from),
        `${from} to ${step.to}`
      ).toMatchObject({ reason: 'too-new' })
    }
  })
})
