import type { LayoutEngine } from './interface'

export type EngineType = 'fabric' | 'konva'

// Registry populated by adapter modules at import time
const registry = new Map<EngineType, new () => LayoutEngine>()

export function registerEngine(type: EngineType, ctor: new () => LayoutEngine): void {
  registry.set(type, ctor)
}

export function createLayoutEngine(type: EngineType): LayoutEngine {
  const Ctor = registry.get(type)
  if (!Ctor) {
    throw new Error(
      `Engine "${type}" is not registered. Import the adapter module before calling createLayoutEngine.`
    )
  }
  return new Ctor()
}
