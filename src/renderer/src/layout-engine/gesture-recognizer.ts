/**
 * GestureRecognizer — engine-agnostic input processor.
 *
 * Captures DOM pointer/wheel/keyboard events from the canvas container
 * div (capture phase) and translates them into semantic gestures.
 * The recognizer owns disambiguation: is this a pan, a drag,
 * a click-select, or a rubber-band?
 *
 * Engines implement InputActionHandler to receive high-level commands.
 * The recognizer never touches shapes, groups, or engine internals.
 */

import type { InputActionHandler } from './input-action-handler'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum pointer movement (px) to distinguish drag from click */
const DRAG_THRESHOLD = 5

// ─── Gesture Mode ───────────────────────────────────────────────────────────

type GestureMode = 'idle' | 'panning' | 'dragReady' | 'rubberBand'

// ─── GestureRecognizer ──────────────────────────────────────────────────────

export class GestureRecognizer {
  private handler: InputActionHandler | null = null
  private container: HTMLDivElement | null = null
  private mode: GestureMode = 'idle'

  /** Screen-space coordinates where the current gesture began */
  private startScreenX = 0
  private startScreenY = 0

  /** Most recent screen-space pointer position */
  private lastScreenX = 0
  private lastScreenY = 0

  /** ID of the target object at gesture start (for dragReady → clickSelect) */
  private startTargetId: string | null = null

  /** Whether shift was held at gesture start */
  private startShift = false

  // Bound listener references for removal
  private readonly onPointerDown = this.handlePointerDown.bind(this)
  private readonly onPointerMove = this.handlePointerMove.bind(this)
  private readonly onPointerUp = this.handlePointerUp.bind(this)
  private readonly onWheel = this.handleWheel.bind(this)
  private readonly onBlur = this.handleBlur.bind(this)
  private readonly onContextMenu = this.handleContextMenu.bind(this)

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Attach DOM listeners to the container (capture phase). */
  attach(container: HTMLDivElement): void {
    this.container = container
    container.addEventListener('pointerdown', this.onPointerDown, { capture: true })
    container.addEventListener('pointermove', this.onPointerMove, { capture: true })
    container.addEventListener('pointerup', this.onPointerUp, { capture: true })
    container.addEventListener('wheel', this.onWheel, { capture: true, passive: false })
    container.addEventListener('contextmenu', this.onContextMenu, { capture: true })
    window.addEventListener('blur', this.onBlur)
  }

  /** Swap the action handler (e.g., when switching engines). Cancels any in-progress gesture. */
  setActionHandler(handler: InputActionHandler): void {
    this.cancel()
    this.handler = handler
  }

  /** Remove all DOM listeners and reset state. */
  dispose(): void {
    this.cancel()
    if (this.container) {
      this.container.removeEventListener('pointerdown', this.onPointerDown, { capture: true })
      this.container.removeEventListener('pointermove', this.onPointerMove, { capture: true })
      this.container.removeEventListener('pointerup', this.onPointerUp, { capture: true })
      this.container.removeEventListener('wheel', this.onWheel, { capture: true })
      this.container.removeEventListener('contextmenu', this.onContextMenu, { capture: true })
      window.removeEventListener('blur', this.onBlur)
      this.container = null
    }
    this.handler = null
  }

  /** Cancel any in-progress gesture and reset to idle. */
  cancel(): void {
    if (this.mode === 'panning') {
      this.handler?.setDragEnabled(true)
    }
    if (this.mode === 'rubberBand') {
      this.handler?.hideRubberBand()
    }
    this.mode = 'idle'
    this.startTargetId = null
  }

  // ─── Event Handlers ─────────────────────────────────────────────────────────

  private handlePointerDown(e: PointerEvent): void {
    if (!this.handler) return

    const isPan = this.isPanTrigger(e)

    if (isPan) {
      // Pan gesture: Alt + primary, or middle-click
      this.mode = 'panning'
      this.startScreenX = e.clientX
      this.startScreenY = e.clientY
      this.lastScreenX = e.clientX
      this.lastScreenY = e.clientY
      this.handler.setDragEnabled(false)
      this.container?.setPointerCapture(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Only handle primary button from here
    if (e.button !== 0) return

    // Hit-test to determine what's under the pointer
    const sc = this.toContainerCoords(e.clientX, e.clientY)
    const world = this.handler.screenToWorld(sc.x, sc.y)
    const hit = this.handler.objectAt(world.x, world.y)

    this.startScreenX = e.clientX
    this.startScreenY = e.clientY
    this.lastScreenX = e.clientX
    this.lastScreenY = e.clientY
    this.startShift = e.shiftKey

    if (hit) {
      // Press on a shape/group → dragReady (wait for threshold or release)
      // Let event propagate so the engine can start native drag/resize
      this.mode = 'dragReady'
      this.startTargetId = hit.id
    } else {
      // Press on empty canvas → rubberBand candidate (wait for threshold)
      // Stop propagation to prevent the engine's native rubber-band (Fabric)
      this.mode = 'dragReady'
      this.startTargetId = null
      e.stopPropagation()
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.handler) return

    switch (this.mode) {
      case 'panning': {
        const dx = e.clientX - this.lastScreenX
        const dy = e.clientY - this.lastScreenY
        this.lastScreenX = e.clientX
        this.lastScreenY = e.clientY
        this.handler.applyPan(dx, dy)
        e.preventDefault()
        e.stopPropagation()
        break
      }

      case 'dragReady': {
        const dx = e.clientX - this.startScreenX
        const dy = e.clientY - this.startScreenY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= DRAG_THRESHOLD) {
          if (this.startTargetId === null && !this.handler.isInteracting()) {
            // Empty canvas drag (no engine interaction in progress) → rubber-band
            this.mode = 'rubberBand'
            this.updateRubberBand(e)
            e.preventDefault()
            e.stopPropagation()
          } else {
            // Object drag or engine-initiated interaction (resize/transform)
            // → let the engine handle it natively
            this.mode = 'idle'
            this.startTargetId = null
          }
        }
        break
      }

      case 'rubberBand': {
        this.updateRubberBand(e)
        e.preventDefault()
        e.stopPropagation()
        break
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.handler) return

    switch (this.mode) {
      case 'panning': {
        this.handler.setDragEnabled(true)
        this.mode = 'idle'
        this.container?.releasePointerCapture(e.pointerId)
        e.preventDefault()
        e.stopPropagation()
        break
      }

      case 'dragReady': {
        // Pointer released without exceeding drag threshold → click
        if (this.startTargetId) {
          // Click on a shape/group
          if (this.startShift) {
            // Shift-click: toggle selection
            this.handler.addToSelection([this.startTargetId])
          } else {
            this.handler.selectIds([this.startTargetId])
          }
        } else {
          // Click on empty canvas
          if (!this.startShift) {
            this.handler.clearSelection()
          }
        }
        this.mode = 'idle'
        this.startTargetId = null
        break
      }

      case 'rubberBand': {
        // Finalize rubber-band selection
        const rect = this.computeRubberBandRect(e.clientX, e.clientY)
        const hits = this.handler.objectsInRect(rect)
        if (hits.length > 0) {
          if (this.startShift) {
            this.handler.addToSelection(hits.map((h) => h.id))
          } else {
            this.handler.selectIds(hits.map((h) => h.id))
          }
        } else if (!this.startShift) {
          this.handler.clearSelection()
        }
        this.handler.hideRubberBand()
        this.mode = 'idle'
        break
      }
    }
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.handler) return
    e.preventDefault()
    const sc = this.toContainerCoords(e.clientX, e.clientY)
    this.handler.applyZoom(e.deltaY, sc.x, sc.y)
  }

  private handleBlur(): void {
    this.cancel()
  }

  private handleContextMenu(e: MouseEvent): void {
    // Suppress context menu on middle-click release
    if (this.mode === 'panning') {
      e.preventDefault()
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Convert viewport-relative clientX/clientY to container-relative coordinates.
   * DOM events report positions relative to the browser viewport, but engines
   * expect coordinates relative to their container element.
   */
  private toContainerCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.container) return { x: clientX, y: clientY }
    const rect = this.container.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  /** Check if this event should trigger a pan gesture. */
  private isPanTrigger(e: PointerEvent): boolean {
    // Middle-click (button 1)
    if (e.button === 1) return true
    // Alt + primary click
    if (e.button === 0 && e.altKey) return true
    return false
  }

  /** Compute the world-space rubber-band rectangle. */
  private computeRubberBandRect(
    currentClientX: number,
    currentClientY: number
  ): { x: number; y: number; width: number; height: number } {
    if (!this.handler) return { x: 0, y: 0, width: 0, height: 0 }

    const startSc = this.toContainerCoords(this.startScreenX, this.startScreenY)
    const endSc = this.toContainerCoords(currentClientX, currentClientY)
    const start = this.handler.screenToWorld(startSc.x, startSc.y)
    const end = this.handler.screenToWorld(endSc.x, endSc.y)

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)

    return { x, y, width, height }
  }

  /** Update the rubber-band overlay. */
  private updateRubberBand(e: PointerEvent): void {
    const rect = this.computeRubberBandRect(e.clientX, e.clientY)
    this.handler?.showRubberBand(rect)
  }
}
