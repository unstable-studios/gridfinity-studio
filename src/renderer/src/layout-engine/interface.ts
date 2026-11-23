import type {
  LayoutShape,
  LayoutGroup,
  LayoutSnapshot,
  GridConfig,
  ViewportState,
  ViewportInsets,
  EngineEventMap,
  GroupDecoration
} from './types'
import type { HitResult } from './input-action-handler'
import type { ShapeAABB } from './containment'
import type { ShapeMove } from './arrange'

export interface LayoutEngine {
  // ─── Lifecycle ──────────────────────────────────────────────────────────────
  mount(container: HTMLDivElement): void
  dispose(): void
  resize(width: number, height: number): void

  // ─── Shape CRUD ─────────────────────────────────────────────────────────────
  addShape(shape: LayoutShape): void
  /**
   * Change a shape's properties. The change is one undo step.
   *
   * With `transient`, it is one step of an adjustment still in progress (a
   * value being scrubbed): the shape updates for live feedback and nothing is
   * recorded. Finish the adjustment with a call that is not transient.
   *
   * This never reassigns the shape's bin. Use `translateShapes` for a
   * finished move.
   */
  updateShape(id: string, patch: Partial<LayoutShape>, options?: { transient?: boolean }): void
  removeShape(id: string): void
  getShape(id: string): LayoutShape | undefined
  getAllShapes(): LayoutShape[]
  /** World-space bounding box of a shape as drawn, including rotation. */
  getShapeBounds(id: string): ShapeAABB | undefined
  /**
   * Move shapes by world-space offsets as one change. A shape whose center
   * lands in a different bin, or outside every bin, is reassigned.
   */
  translateShapes(moves: ShapeMove[]): void

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
  /** Alias for select() — used by InputActionHandler. */
  selectIds(ids: string[]): void
  addToSelection(ids: string[]): void
  removeFromSelection(ids: string[]): void
  clearSelection(): void
  getSelectedIds(): string[]

  // ─── Viewport ───────────────────────────────────────────────────────────────
  panTo(x: number, y: number): void
  zoomTo(level: number, center?: { x: number; y: number }): void
  resetView(): void
  getViewport(): ViewportState

  /**
   * Set viewport insets for UI overlays (sidebar, toolbar).
   * Affects where resetView() and initial mount position the origin.
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

  /**
   * Run several mutations as one change. Events raised inside `fn` are
   * delivered after it returns, so a listener that reads the engine sees the
   * final state. Each payload still describes its own mutation as it was made.
   */
  batch(fn: () => void): void

  // ─── Serialization ─────────────────────────────────────────────────────────
  toSnapshot(): LayoutSnapshot
  loadSnapshot(snapshot: LayoutSnapshot): void

  // ─── Theme ────────────────────────────────────────────────────────────────
  setThemeColors(colors: { background: string; grid: string; gridOrigin: string }): void

  /**
   * Update the project's `unitHeight` (mm per height unit). Used to derive
   * each shape's render-time opacity from its pocket depth — see
   * `depthToOpacity` in shared/types/project. Triggers a refresh of all
   * grouped shapes' opacities.
   */
  setUnitHeight(mm: number): void

  // ─── Capabilities ──────────────────────────────────────────────────────────
  capabilities(): Set<string>

  // ─── Interaction State ─────────────────────────────────────────────────────
  isInteracting(): boolean

  // ─── Input Action Handler Methods ───────────────────────────────────────────

  /** Translate the viewport by a screen-space pixel delta. */
  applyPan(dx: number, dy: number): void

  /**
   * Scale the viewport centered on the given screen-space point.
   * `delta` is the raw wheel deltaY; the handler applies the
   * zoom curve and clamping (0.1x–10x).
   */
  applyZoom(delta: number, centerX: number, centerY: number): void

  /**
   * Enable or disable the engine's internal drag handling.
   * Called by the gesture recognizer to suppress drags during pan.
   */
  setDragEnabled(enabled: boolean): void

  /**
   * Return the topmost shape or group at the given world-space point,
   * or null if the point is on empty canvas.
   */
  objectAt(worldX: number, worldY: number): HitResult | null

  /**
   * Return all shapes and groups whose bounding boxes intersect
   * the given world-space rectangle.
   */
  objectsInRect(rect: { x: number; y: number; width: number; height: number }): HitResult[]

  /** Convert screen-space (client) coordinates to world-space. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number }

  // ─── Rubber-Band Overlay ──────────────────────────────────────────────────

  /** Show a selection rectangle at the given world-space bounds. */
  showRubberBand(rect: { x: number; y: number; width: number; height: number }): void

  /** Remove the rubber-band overlay. */
  hideRubberBand(): void
}
