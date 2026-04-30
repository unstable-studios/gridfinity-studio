import * as fabric from 'fabric'
import type { GroupRenderer } from './group-renderer'
import type { LayoutGroup, GroupDecoration } from './types'
import { snapLowerLeft } from './input-math'

/**
 * Fabric.js implementation of GroupRenderer.
 *
 * Handles internally:
 * - `originX/Y: 'center'` group positioning (centroid)
 * - `__groupBg` rect as first child
 * - `_objects` direct manipulation for decorations (bypassing `enterGroup` + layout)
 * - Splicing decorations before `triggerLayout()`, re-adding after
 * - `objectCaching: false` on the group
 * - `setCoords()` after position changes
 * - Centroid ↔ lower-left conversion
 */
export class FabricGroupRenderer implements GroupRenderer {
  readonly fabricGroup: fabric.Group
  private width: number
  private height: number
  private canvas: fabric.Canvas
  private origStroke: string
  private origStrokeWidth: number
  private highlighted = false

  constructor(group: LayoutGroup, canvas: fabric.Canvas) {
    this.canvas = canvas
    this.width = group.width
    this.height = group.height
    this.origStroke = group.style.stroke
    this.origStrokeWidth = group.style.strokeWidth

    const bgRect = new fabric.Rect({
      left: -group.width / 2,
      top: -group.height / 2,
      width: group.width,
      height: group.height,
      fill: group.style.fill,
      stroke: group.style.stroke,
      strokeWidth: group.style.strokeWidth,
      strokeUniform: true,
      rx: group.style.cornerRadius ?? 0,
      ry: group.style.cornerRadius ?? 0,
      selectable: false,
      evented: false
    })
    ;(bgRect as unknown as Record<string, unknown>).__groupBg = true

    // Lower-left → centroid
    const centroidX = group.x + group.width / 2
    const centroidY = group.y - group.height / 2

    this.fabricGroup = new fabric.Group([bgRect], {
      left: centroidX,
      top: centroidY,
      width: group.width,
      height: group.height,
      subTargetCheck: true,
      interactive: true,
      lockScalingFlip: true,
      lockRotation: true,
      hasBorders: true,
      hasControls: true,
      borderColor: '#60a5fa',
      borderDashArray: [4, 3],
      borderScaleFactor: 1.5,
      padding: 2,
      originX: 'center',
      originY: 'center',
      objectCaching: false
    })

    // Show edge + corner resize controls; no rotation handle
    this.fabricGroup.setControlsVisibility({
      ml: true,
      mr: true,
      mt: true,
      mb: true,
      tl: true,
      tr: true,
      bl: true,
      br: true,
      mtr: false
    })
  }

  update(patch: Partial<LayoutGroup>, current: LayoutGroup): void {
    this.width = current.width
    this.height = current.height

    if (patch.rotation !== undefined) {
      this.fabricGroup.set('angle', patch.rotation)
    }

    if (patch.width !== undefined || patch.height !== undefined || patch.style !== undefined) {
      this.updateBgRect(patch, current)
      this.triggerLayoutSafe()
    }

    if (patch.style !== undefined) {
      // Keep canonical stroke/width in sync so flashCollision and unhighlight
      // restore the latest style, not the value captured at construction.
      this.origStroke = current.style.stroke
      this.origStrokeWidth = current.style.strokeWidth
    }

    // Set centroid position AFTER triggerLayout so it doesn't get overridden
    if (
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.width !== undefined ||
      patch.height !== undefined
    ) {
      this.fabricGroup.set('left', current.x + current.width / 2)
      this.fabricGroup.set('top', current.y - current.height / 2)
    }

    this.fabricGroup.setCoords()
    this.canvas.requestRenderAll()
  }

  setDecorations(decorations: GroupDecoration[]): void {
    // Bypass Fabric's group.add()/remove() entirely for decorations.
    //
    // Why: group.add() calls enterGroup() which applies the inverse group
    // transform (treating coords as canvas-space), then FitContentLayout
    // recalculates group bounds from ALL children and shifts everything.
    // Decorations are purely visual and should not participate in layout.
    //
    // We manipulate _objects directly. Decoration coords are already in
    // group-local space (relative to centroid), matching the bgRect which
    // sits at (-width/2, -height/2).
    //
    // Note: getObjects() returns a copy — we must access _objects directly.
    const internalObjects = this.getInternalObjects()

    // Remove existing decorations
    for (let i = internalObjects.length - 1; i >= 0; i--) {
      if ((internalObjects[i] as unknown as Record<string, unknown>).__binArtwork) {
        internalObjects.splice(i, 1)
      }
    }

    // Add new decorations directly to the group's internal array
    for (const dec of decorations) {
      let obj: fabric.FabricObject
      if (dec.type === 'circle') {
        obj = new fabric.Circle({
          left: dec.cx,
          top: dec.cy,
          radius: dec.radius,
          originX: 'center',
          originY: 'center',
          fill: dec.fill,
          stroke: dec.stroke,
          strokeWidth: dec.strokeWidth,
          strokeDashArray: dec.dash ?? null,
          strokeUniform: true,
          selectable: false,
          evented: false,
          objectCaching: false
        })
      } else {
        // Use center origin to match circles — bypassing enterGroup means
        // non-center origins render at the wrong position because Fabric's
        // calcOwnMatrix() applies an origin-based offset we can't predict
        // without going through the full enterGroup transform.
        obj = new fabric.Rect({
          left: dec.x + dec.width / 2,
          top: dec.y + dec.height / 2,
          width: dec.width,
          height: dec.height,
          rx: dec.cornerRadius ?? 0,
          ry: dec.cornerRadius ?? 0,
          originX: 'center',
          originY: 'center',
          fill: dec.fill,
          stroke: dec.stroke,
          strokeWidth: dec.strokeWidth,
          strokeDashArray: dec.dash ?? null,
          strokeUniform: true,
          selectable: false,
          evented: false,
          objectCaching: false
        })
      }
      // Set refs needed for rendering inside the group
      obj._set('parent', this.fabricGroup)
      obj._set('group', this.fabricGroup)
      obj._set('canvas', this.canvas)
      ;(obj as unknown as Record<string, unknown>).__binArtwork = true
      internalObjects.push(obj)
    }

    // Invalidate cache and render
    this.fabricGroup.set('dirty', true)
    this.canvas.requestRenderAll()
  }

  readPosition(): { x: number; y: number; rotation: number } {
    // Use calcTransformMatrix() to get world position — when the group is
    // inside an ActiveSelection (multi-select), left/top are relative to
    // the selection center, not the canvas. The transform matrix always
    // gives us the true world centroid regardless of selection state.
    const matrix = this.fabricGroup.calcTransformMatrix()
    const centroidX = matrix[4]
    const centroidY = matrix[5]
    return {
      x: centroidX - this.width / 2,
      y: centroidY + this.height / 2,
      rotation: this.fabricGroup.angle ?? 0
    }
  }

  snapToGrid(gridSize: number): void {
    const halfW = this.width / 2
    const halfH = this.height / 2
    const lowerLeftX = (this.fabricGroup.left ?? 0) - halfW
    const lowerLeftY = (this.fabricGroup.top ?? 0) + halfH
    const snapped = snapLowerLeft(lowerLeftX, lowerLeftY, gridSize)
    this.fabricGroup.set({ left: snapped.x + halfW, top: snapped.y - halfH })
    this.fabricGroup.setCoords()
  }

  /** Highlight this group as a drop target during shape drag. */
  highlight(): void {
    if (this.highlighted) return
    this.highlighted = true
    const bgRect = this.fabricGroup
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
    if (!bgRect) return
    bgRect.set({ stroke: '#3b82f6', strokeWidth: 2 })
    this.canvas.requestRenderAll()
  }

  /** Remove drop-target highlight, restoring original stroke. */
  unhighlight(): void {
    if (!this.highlighted) return
    this.highlighted = false
    const bgRect = this.fabricGroup
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
    if (!bgRect) return
    bgRect.set({ stroke: this.origStroke, strokeWidth: this.origStrokeWidth })
    this.canvas.requestRenderAll()
  }

  destroy(): void {
    this.canvas.remove(this.fabricGroup)
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  private getInternalObjects(): fabric.FabricObject[] {
    return (this.fabricGroup as unknown as { _objects: fabric.FabricObject[] })._objects
  }

  private updateBgRect(patch: Partial<LayoutGroup>, current: LayoutGroup): void {
    const bgRect = this.fabricGroup
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
    if (!bgRect) return

    if (patch.width !== undefined) {
      bgRect.set('width', current.width)
      bgRect.set('left', -current.width / 2)
    }
    if (patch.height !== undefined) {
      bgRect.set('height', current.height)
      bgRect.set('top', -current.height / 2)
    }
    if (patch.style) {
      bgRect.set('fill', current.style.fill)
      bgRect.set('stroke', current.style.stroke)
      bgRect.set('strokeWidth', current.style.strokeWidth)
      bgRect.set('rx', current.style.cornerRadius ?? 0)
      bgRect.set('ry', current.style.cornerRadius ?? 0)
    }
  }

  /**
   * triggerLayout() recalculates group bounds from children via FitContentLayout.
   * Decorations and user-shape children must be temporarily removed so they
   * don't inflate bounds (decorations) or get their left/top rewritten to fit
   * the new bbox (user shapes — which would corrupt their position relative
   * to the bin centroid).
   */
  private triggerLayoutSafe(): void {
    const internalObjects = this.getInternalObjects()
    const removed: fabric.FabricObject[] = []

    for (let i = internalObjects.length - 1; i >= 0; i--) {
      const o = internalObjects[i] as unknown as Record<string, unknown>
      if (o.__binArtwork || o.__layoutShapeId) {
        removed.push(internalObjects[i])
        internalObjects.splice(i, 1)
      }
    }
    removed.reverse()

    this.fabricGroup.triggerLayout()

    for (const obj of removed) {
      internalObjects.push(obj)
    }
  }
}
