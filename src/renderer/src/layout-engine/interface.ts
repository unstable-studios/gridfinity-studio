import type {
  LayoutShape,
  LayoutGroup,
  LayoutSnapshot,
  GridConfig,
  ViewportState,
  TransientState,
  EngineEventMap
} from './types'

export interface LayoutEngine {
  // ─── Lifecycle ──────────────────────────────────────────────────────────────
  mount(container: HTMLDivElement): void
  dispose(): void
  resize(width: number, height: number): void

  // ─── Shape CRUD ─────────────────────────────────────────────────────────────
  addShape(shape: LayoutShape): void
  updateShape(id: string, patch: Partial<LayoutShape>): void
  removeShape(id: string): void
  getShape(id: string): LayoutShape | undefined
  getAllShapes(): LayoutShape[]

  // ─── Group Operations ───────────────────────────────────────────────────────
  createGroup(group: LayoutGroup): void
  updateGroup(id: string, patch: Partial<LayoutGroup>): void
  removeGroup(id: string): void
  addToGroup(shapeId: string, groupId: string): void
  removeFromGroup(shapeId: string): void
  getGroup(id: string): LayoutGroup | undefined
  getAllGroups(): LayoutGroup[]

  // ─── Selection ──────────────────────────────────────────────────────────────
  select(ids: string[]): void
  addToSelection(ids: string[]): void
  clearSelection(): void
  getSelectedIds(): string[]

  // ─── Viewport ───────────────────────────────────────────────────────────────
  panTo(x: number, y: number): void
  zoomTo(level: number, center?: { x: number; y: number }): void
  resetView(): void
  getViewport(): ViewportState

  // ─── Grid ───────────────────────────────────────────────────────────────────
  setGridConfig(config: Partial<GridConfig>): void
  getGridConfig(): GridConfig

  // ─── Events ─────────────────────────────────────────────────────────────────
  on<K extends keyof EngineEventMap>(
    event: K,
    handler: (payload: EngineEventMap[K]) => void
  ): () => void

  // ─── Serialization ─────────────────────────────────────────────────────────
  toSnapshot(): LayoutSnapshot
  loadSnapshot(snapshot: LayoutSnapshot): void

  // ─── Transient State (for engine switching) ────────────────────────────────
  getTransientState(): TransientState
  setTransientState(state: TransientState): void

  // ─── Theme ────────────────────────────────────────────────────────────────
  setThemeColors(colors: { background: string; grid: string; gridOrigin: string }): void

  // ─── Capabilities ──────────────────────────────────────────────────────────
  capabilities(): Set<string>

  // ─── Interaction State ─────────────────────────────────────────────────────
  isInteracting(): boolean
}
