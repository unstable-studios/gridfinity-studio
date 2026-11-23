import { describe, it, expect } from 'vitest'
import { BakeQueue } from '../bake-queue'

interface Pending {
  id: string
  resolve: (value: string) => void
  reject: (error: Error) => void
}

function setup(): { queue: BakeQueue<string>; bakes: Pending[]; log: string[]; gone: Set<string> } {
  const bakes: Pending[] = []
  const log: string[] = []
  const gone = new Set<string>()
  const queue = new BakeQueue<string>({
    bake: (id) => {
      if (gone.has(id)) return null
      return new Promise<string>((resolve, reject) => bakes.push({ id, resolve, reject }))
    },
    onStart: (id) => log.push(`start ${id}`),
    onDone: (id, result) => log.push(`done ${id} ${result}`),
    onError: (id, error) => log.push(`error ${id} ${(error as Error).message}`)
  })
  return { queue, bakes, log, gone }
}

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

describe('BakeQueue', () => {
  it('bakes once per request when nothing is running', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    bakes[0].resolve('v1')
    await settled()
    expect(log).toEqual(['start a', 'done a v1'])
    expect(bakes).toHaveLength(1)
  })

  it('runs one more bake after a success when requests arrived meanwhile', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    queue.request('a')
    queue.request('a')
    expect(bakes).toHaveLength(1)

    bakes[0].resolve('v1')
    await settled()
    expect(bakes).toHaveLength(2)

    bakes[1].resolve('v2')
    await settled()
    expect(log).toEqual(['start a', 'done a v1', 'start a', 'done a v2'])
    expect(bakes).toHaveLength(2)
  })

  it('runs one more bake after a failure when a request arrived meanwhile', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    queue.request('a')

    bakes[0].reject(new Error('bad geometry'))
    await settled()
    expect(bakes).toHaveLength(2)

    bakes[1].resolve('v2')
    await settled()
    expect(log).toEqual(['start a', 'error a bad geometry', 'start a', 'done a v2'])
  })

  it('does not bake again after a failure with nothing waiting', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    bakes[0].reject(new Error('bad geometry'))
    await settled()
    expect(log).toEqual(['start a', 'error a bad geometry'])
    expect(bakes).toHaveLength(1)
  })

  it('keeps ids independent', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    queue.request('b')
    expect(bakes.map((b) => b.id)).toEqual(['a', 'b'])
    bakes[1].resolve('b1')
    await settled()
    expect(log).toEqual(['start a', 'start b', 'done b b1'])
  })

  it('ignores the result of a bake for a forgotten id', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    queue.request('a')
    queue.forget('a')
    bakes[0].resolve('stale')
    await settled()
    expect(log).toEqual(['start a'])
    expect(bakes).toHaveLength(1)
  })

  it('bakes a forgotten id again when it comes back, ignoring the old bake', async () => {
    const { queue, bakes, log } = setup()
    queue.request('a')
    queue.forget('a')
    queue.request('a')
    expect(bakes).toHaveLength(2)

    bakes[1].resolve('fresh')
    bakes[0].resolve('stale')
    await settled()
    expect(log).toEqual(['start a', 'start a', 'done a fresh'])
  })

  it('skips an id with nothing to bake', async () => {
    const { queue, bakes, log, gone } = setup()
    gone.add('a')
    queue.request('a')
    await settled()
    expect(bakes).toHaveLength(0)
    expect(log).toEqual([])
  })
})
