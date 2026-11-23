export interface BakeQueueHandlers<T> {
  /** Start a bake from the current state. Return null when there is nothing to bake. */
  bake: (id: string) => Promise<T> | null
  onStart: (id: string) => void
  onDone: (id: string, result: T) => void
  onError: (id: string, error: unknown) => void
}

/**
 * Runs at most one bake per id at a time. A request that arrives while a bake
 * is running is held, and one more bake starts when the running one settles,
 * whether it succeeded or failed, so the last result always reflects the
 * latest request.
 */
export class BakeQueue<T> {
  private inFlight = new Map<string, symbol>()
  private queued = new Set<string>()
  private readonly handlers: BakeQueueHandlers<T>

  constructor(handlers: BakeQueueHandlers<T>) {
    this.handlers = handlers
  }

  request(id: string): void {
    if (this.inFlight.has(id)) {
      this.queued.add(id)
      return
    }
    this.start(id)
  }

  /** Drop an id. The result of a bake still running for it is ignored. */
  forget(id: string): void {
    this.inFlight.delete(id)
    this.queued.delete(id)
  }

  private start(id: string): void {
    const pending = this.handlers.bake(id)
    if (!pending) return

    const token = Symbol(id)
    this.inFlight.set(id, token)
    this.handlers.onStart(id)

    const settle = (report: () => void): void => {
      if (this.inFlight.get(id) !== token) return
      this.inFlight.delete(id)
      report()
      if (this.queued.delete(id)) this.start(id)
    }
    pending.then(
      (result) => settle(() => this.handlers.onDone(id, result)),
      (error: unknown) => settle(() => this.handlers.onError(id, error))
    )
  }
}
