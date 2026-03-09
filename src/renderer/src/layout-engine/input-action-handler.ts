/**
 * Interface implemented by each layout engine adapter to receive
 * high-level commands from the GestureRecognizer.
 *
 * The gesture recognizer handles input disambiguation; the engine
 * handles execution via its native APIs.
 */

// ─── Hit-Test Results ────────────────────────────────────────────────────────

export interface HitResult {
  /** Whether this is a standalone shape or a bin group */
  type: 'shape' | 'group'
  /** The shape or group ID */
  id: string
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface InputActionHandler {
  // ─── Viewport ─────────────────────────────────────────────────────────────

  /** Translate the viewport by a screen-space pixel delta. */
  applyPan(dx: number, dy: number): void

  /**
   * Scale the viewport centered on the given screen-space point.
   * `delta` is the raw wheel deltaY; the handler applies the
   * zoom curve and clamping (0.1x–10x).
   */
  applyZoom(delta: number, centerX: number, centerY: number): void

  // ─── Drag Suppression ─────────────────────────────────────────────────────

  /**
   * Enable or disable the engine's internal drag handling.
   * Called by the gesture recognizer to suppress drags during pan.
   */
  setDragEnabled(enabled: boolean): void

  // ─── Hit-Test Queries ─────────────────────────────────────────────────────

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

  // ─── Selection ────────────────────────────────────────────────────────────

  /** Replace the current selection with the given IDs. */
  selectIds(ids: string[]): void

  /** Add IDs to the current selection. */
  addToSelection(ids: string[]): void

  /** Remove IDs from the current selection. */
  removeFromSelection(ids: string[]): void

  /** Clear all selection. */
  clearSelection(): void

  // ─── Rubber-Band Overlay ──────────────────────────────────────────────────

  /** Show a selection rectangle at the given world-space bounds. */
  showRubberBand(rect: { x: number; y: number; width: number; height: number }): void

  /** Remove the rubber-band overlay. */
  hideRubberBand(): void

  // ─── Coordinate Conversion ────────────────────────────────────────────────

  /** Convert screen-space (client) coordinates to world-space. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number }

  // ─── Interaction State ──────────────────────────────────────────────────────

  /** Whether the engine is currently handling an interaction (drag, resize, transform). */
  isInteracting(): boolean
}
