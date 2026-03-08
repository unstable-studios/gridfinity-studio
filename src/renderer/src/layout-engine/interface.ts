import type {
  LayoutShape,
  LayoutGroup,
  LayoutSnapshot,
  GridConfig,
  ViewportState,
  ViewportInsets,
  TransientState,
  EngineEventMap,
  GroupDecoration
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

  // ─── Group Decorations ─────────────────────────────────────────────────────
  /** Render non-interactive artwork within a group (replaces any existing decorations) */
  setGroupDecorations(groupId: string, decorations: GroupDecoration[]): void

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

  /**
   * Set viewport insets for UI overlays (sidebar, toolbar).
   * Affects where resetView() and initial mount place the visual center.
   */
  setViewportInsets(insets: ViewportInsets): void

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
