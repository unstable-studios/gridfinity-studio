import { describe, it, expect } from 'vitest'
import { addPendingCommit, flushPendingCommits } from '../pending-commits'

describe('pending commits', () => {
  it('runs each waiting commit once', () => {
    const ran: string[] = []
    addPendingCommit(() => ran.push('a'))
    addPendingCommit(() => ran.push('b'))
    flushPendingCommits()
    flushPendingCommits()
    expect(ran).toEqual(['a', 'b'])
  })

  it('does not run a commit that was withdrawn', () => {
    const ran: string[] = []
    const withdraw = addPendingCommit(() => ran.push('a'))
    withdraw()
    flushPendingCommits()
    expect(ran).toEqual([])
  })

  it('runs a commit registered while flushing on the next flush', () => {
    const ran: string[] = []
    addPendingCommit(() => {
      ran.push('first')
      addPendingCommit(() => ran.push('second'))
    })
    flushPendingCommits()
    expect(ran).toEqual(['first'])
    flushPendingCommits()
    expect(ran).toEqual(['first', 'second'])
  })
})
