/**
 * Contract: GestureRecognizer
 *
 * Engine-agnostic input processor that captures DOM pointer/wheel
 * events from the canvas container div and translates them into
 * semantic gesture events. The recognizer owns disambiguation:
 * is this a pan, a drag, a click-select, or a rubber-band?
 *
 * This is a DESIGN CONTRACT — not production code.
 */

// ─── Gesture Events (discriminated union) ────────────────────────────────────

type GestureEvent =
  | { type: 'panStart'; screenX: number; screenY: number }
  | { type: 'panMove'; dx: number; dy: number }
  | { type: 'panEnd' }
  | { type: 'zoom'; delta: number; centerX: number; centerY: number }
  | {
      type: 'clickSelect'
      worldX: number
      worldY: number
      targetId: string | null
      shift: boolean
    }
  | { type: 'clearSelect' }
  | { type: 'rubberBandStart'; worldX: number; worldY: number }
  | {
      type: 'rubberBandMove'
      rect: { x: number; y: number; width: number; height: number }
    }
  | {
      type: 'rubberBandEnd'
      rect: { x: number; y: number; width: number; height: number }
    }
  | { type: 'dragReady'; targetId: string }
  | { type: 'dragCancel' }

// ─── Gesture Recognizer ──────────────────────────────────────────────────────

/**
 * The recognizer is a plain class (not a React hook) so it can be
 * instantiated in the LayoutEngineContext and shared between engines.
 *
 * Usage:
 *   const recognizer = new GestureRecognizer(container, actionHandler)
 *   // on engine switch:
 *   recognizer.setActionHandler(newHandler)
 *   // on unmount:
 *   recognizer.dispose()
 */
interface GestureRecognizerContract {
  /**
   * Attach DOM listeners to the container. Called once during mount.
   * Uses capture phase so events are intercepted before engines.
   */
  attach(container: HTMLDivElement): void

  /**
   * Swap the action handler (e.g., when switching engines).
   * Cancels any in-progress gesture first.
   */
  setActionHandler(handler: InputActionHandler): void

  /**
   * Remove all DOM listeners and reset state.
   */
  dispose(): void

  /**
   * Cancel any in-progress gesture and reset to idle.
   * Called on engine switch, blur, or escape key.
   */
  cancel(): void
}

// ─── Gesture Modes (state machine) ───────────────────────────────────────────

type GestureMode = 'idle' | 'panning' | 'dragReady' | 'dragging' | 'rubberBand'

/**
 * State transitions:
 *
 * idle → panning:      Alt/middle-click on anything
 * idle → dragReady:    Primary press on shape/group
 * dragReady → dragging: Pointer moves past DRAG_THRESHOLD (5px)
 * dragReady → idle:    Pointer released (→ clickSelect)
 * idle → rubberBand:   Primary press on empty canvas + drag past threshold
 * rubberBand → idle:   Pointer released (→ selectIds from objectsInRect)
 * rubberBand → panning: Alt pressed mid-rubber-band
 * panning → idle:      Button release / Alt release / window blur
 * any → idle:          cancel() called
 */

export type { GestureEvent, GestureRecognizerContract, GestureMode }
