import type { LayoutEngine } from './interface'
import { KonvaEngine } from './konva-engine'

/**
 * The one place that binds the LayoutEngine interface to its adapter.
 * Application code depends on the interface and calls this to get an instance.
 */
export function createLayoutEngine(): LayoutEngine {
  return new KonvaEngine()
}
