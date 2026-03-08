import Konva from 'konva'
import type { GroupRenderer } from './group-renderer'
import type { LayoutGroup, GroupDecoration, GridConfig } from './types'
import { checkGroupCollision } from './collision'

/**
 * Dependencies injected from the KonvaEngine.
 * Avoids tight coupling while giving the renderer access to engine state.
 */
export interface KonvaGroupRendererDeps {
  layer: Konva.Layer
  getGridConfig(): GridConfig
  getTransformer(): Konva.Transformer | null
  getAllGroups(): LayoutGroup[]
}

/**
 * Konva implementation of GroupRenderer.
 *
 * Handles internally:
 * - Konva.Group positioned at centroid
 * - `.__groupBg` Konva.Rect background
 * - `.__binArtwork` decoration nodes
 * - Transformer node refresh after decoration/size changes
 * - `dragmove`/`dragend` grid snap (lower-left based)
 * - Centroid ↔ lower-left conversion
 */
export class KonvaGroupRenderer implements GroupRenderer {
  readonly konvaGroup: Konva.Group
  private width: number
  private height: number
  private groupId: string
  private deps: KonvaGroupRendererDeps
  private onMoved: (id: string, x: number, y: number) => void
  private onResized:
    | ((id: string, x: number, y: number, width: number, height: number) => void)
    | null = null
  private onCollisionRejected: ((id: string, reason: 'move' | 'resize') => void) | null = null

  /** Last known non-colliding centroid during drag, for live collision prevention. */
  private lastGoodPos: { x: number; y: number } | null = null
  /** Snapshot of bounds before a resize starts, for edge-anchoring. */
  private preResizeBounds: { x: number; y: number; width: number; height: number } | null = null

  constructor(
    group: LayoutGroup,
    deps: KonvaGroupRendererDeps,
    onMoved: (id: string, x: number, y: number) => void,
    onResized?: (id: string, x: number, y: number, width: number, height: number) => void,
    onCollisionRejected?: (id: string, reason: 'move' | 'resize') => void
  ) {
    this.deps = deps
    this.onMoved = onMoved
    this.onResized = onResized ?? null
    this.onCollisionRejected = onCollisionRejected ?? null
    this.groupId = group.id
    this.width = group.width
    this.height = group.height

    // Lower-left → centroid
    const centroidX = group.x + group.width / 2
    const centroidY = group.y - group.height / 2

    this.konvaGroup = new Konva.Group({
      x: centroidX,
      y: centroidY,
      rotation: group.rotation,
      draggable: true,
      id: group.id,
      name: 'group'
    })

    const bgRect = new Konva.Rect({
      x: -group.width / 2,
      y: -group.height / 2,
      width: group.width,
      height: group.height,
      fill: group.style.fill,
      stroke: group.style.stroke,
      strokeWidth: group.style.strokeWidth,
      strokeScaleEnabled: false,
      cornerRadius: group.style.cornerRadius ?? 0,
      listening: true,
      name: '__groupBg'
    })
    this.konvaGroup.add(bgRect)

    this.setupSnapHandlers()
    this.setupResizeHandlers()
  }

  update(patch: Partial<LayoutGroup>, current: LayoutGroup): void {
    this.width = current.width
    this.height = current.height

    // Recompute centroid when position or dimensions change
    if (
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.width !== undefined ||
      patch.height !== undefined
    ) {
      this.konvaGroup.x(current.x + current.width / 2)
      this.konvaGroup.y(current.y - current.height / 2)
    }
    if (patch.rotation !== undefined) {
      this.konvaGroup.rotation(patch.rotation)
    }

    // Update background rect
    if (patch.width !== undefined || patch.height !== undefined || patch.style !== undefined) {
      const bgRect = this.konvaGroup.findOne('.__groupBg')
      if (bgRect) {
        if (patch.width !== undefined) {
          bgRect.setAttrs({ width: current.width, x: -current.width / 2 })
        }
        if (patch.height !== undefined) {
          bgRect.setAttrs({ height: current.height, y: -current.height / 2 })
        }
        if (patch.style) {
          bgRect.setAttrs({
            fill: current.style.fill,
            stroke: current.style.stroke,
            strokeWidth: current.style.strokeWidth,
            cornerRadius: current.style.cornerRadius ?? 0
          })
        }
      }
    }

    this.refreshTransformerIfSelected()
    this.deps.layer.batchDraw()
  }

  setDecorations(decorations: GroupDecoration[]): void {
    // Remove existing decorations
    const existing = this.konvaGroup.find('.__binArtwork')
    for (const node of existing) {
      node.destroy()
    }

    // Add new decorations
    for (const dec of decorations) {
      let node: Konva.Shape
      if (dec.type === 'circle') {
        node = new Konva.Circle({
          x: dec.cx,
          y: dec.cy,
          radius: dec.radius,
          fill: dec.fill,
          stroke: dec.stroke,
          strokeWidth: dec.strokeWidth,
          dash: dec.dash,
          strokeScaleEnabled: false,
          listening: false,
          name: '__binArtwork'
        })
      } else {
        node = new Konva.Rect({
          x: dec.x,
          y: dec.y,
          width: dec.width,
          height: dec.height,
          cornerRadius: dec.cornerRadius ?? 0,
          fill: dec.fill,
          stroke: dec.stroke,
          strokeWidth: dec.strokeWidth,
          dash: dec.dash,
          strokeScaleEnabled: false,
          listening: false,
          name: '__binArtwork'
        })
      }
      this.konvaGroup.add(node)
    }

    // Move bg rect behind everything
    const bg = this.konvaGroup.findOne('.__groupBg')
    if (bg) bg.moveToBottom()

    // Refresh transformer — stale decorations from the previous bin size
    // inflate the Group's getClientRect() bounds, causing the transformer
    // frame to lag behind when a bin shrinks.
    this.refreshTransformerForDecorations()
    this.deps.layer.batchDraw()
  }

  readPosition(): { x: number; y: number; rotation: number } {
    // Centroid → lower-left
    return {
      x: this.konvaGroup.x() - this.width / 2,
      y: this.konvaGroup.y() + this.height / 2,
      rotation: this.konvaGroup.rotation()
    }
  }

  snapToGrid(gridSize: number): void {
    const halfW = this.width / 2
    const halfH = this.height / 2
    const lowerLeftX = this.konvaGroup.x() - halfW
    const lowerLeftY = this.konvaGroup.y() + halfH
    this.konvaGroup.position({
      x: Math.round(lowerLeftX / gridSize) * gridSize + halfW,
      y: Math.round(lowerLeftY / gridSize) * gridSize - halfH
    })
    this.deps.getTransformer()?.forceUpdate()
  }

  destroy(): void {
    this.konvaGroup.destroy()
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  private setupSnapHandlers(): void {
    // Save initial position as last-good for live collision prevention
    this.konvaGroup.on('dragstart', () => {
      this.lastGoodPos = { x: this.konvaGroup.x(), y: this.konvaGroup.y() }
    })

    // Snap to grid + live collision prevention during drag.
    // Multi-select: skip — Konva's Transformer fights per-node corrections.
    this.konvaGroup.on('dragmove', () => {
      const gridConfig = this.deps.getGridConfig()
      const selectedNodes = this.deps.getTransformer()?.nodes() ?? []
      if (selectedNodes.length > 1) return

      if (gridConfig.enabled) {
        this.snapToGrid(gridConfig.size)
      }

      // Live collision check — revert to last good position if overlapping
      const pos = this.readPosition()
      const proposed = { x: pos.x, y: pos.y, width: this.width, height: this.height }
      const collider = checkGroupCollision(proposed, this.groupId, this.deps.getAllGroups())
      if (collider && this.lastGoodPos) {
        this.konvaGroup.position(this.lastGoodPos)
        this.deps.getTransformer()?.forceUpdate()
      } else {
        this.lastGoodPos = { x: this.konvaGroup.x(), y: this.konvaGroup.y() }
      }
    })

    // On drag end: final snap + sync data model. Safety collision check
    // for edge cases (multi-select, etc.) — flash red only if truly overlapping.
    this.konvaGroup.on('dragend', () => {
      const gridConfig = this.deps.getGridConfig()
      if (gridConfig.enabled) {
        this.snapToGrid(gridConfig.size)
      }

      const pos = this.readPosition()
      const proposed = { x: pos.x, y: pos.y, width: this.width, height: this.height }
      const collider = checkGroupCollision(proposed, this.groupId, this.deps.getAllGroups())
      if (collider && this.lastGoodPos) {
        this.konvaGroup.position(this.lastGoodPos)
        this.deps.getTransformer()?.forceUpdate()
        this.flashCollision()
        this.onCollisionRejected?.(this.groupId, 'move')
        this.lastGoodPos = null
        return
      }

      this.lastGoodPos = null
      this.onMoved(this.groupId, pos.x, pos.y)
    })
  }

  private setupResizeHandlers(): void {
    // Save bounds before resize; show ghost preview (hide decorations, fade fill).
    this.konvaGroup.on('transformstart', () => {
      const pos = this.readPosition()
      this.preResizeBounds = { x: pos.x, y: pos.y, width: this.width, height: this.height }
      this.setResizeGhost(true)
    })

    // Konva Transformer applies scale to the group during resize.
    // Don't snap during live drag — modifying scale inside `transform` fights
    // the Transformer's position anchoring. Snap on release only.
    this.konvaGroup.on('transformend', () => {
      this.setResizeGhost(false)
      const gridConfig = this.deps.getGridConfig()
      const gs = gridConfig.size
      const orig = this.preResizeBounds
      if (!orig) return

      const sx = this.konvaGroup.scaleX()
      const sy = this.konvaGroup.scaleY()

      // Compute new dimensions (grid-quantized)
      let newW = this.width * sx
      let newH = this.height * sy
      if (gridConfig.enabled) {
        newW = Math.max(gs, Math.round(newW / gs) * gs)
        newH = Math.max(gs, Math.round(newH / gs) * gs)
      }

      // Determine which edges were anchored by comparing the Transformer's
      // visual result to the original bounds. The anchored edge barely moved.
      const centroidX = this.konvaGroup.x()
      const centroidY = this.konvaGroup.y()
      const visualLeft = centroidX - (this.width * sx) / 2
      const visualRight = centroidX + (this.width * sx) / 2
      const visualTop = centroidY - (this.height * sy) / 2
      const visualBottom = centroidY + (this.height * sy) / 2

      const origLeft = orig.x
      const origRight = orig.x + orig.width
      const origTop = orig.y - orig.height // top in screen coords (smaller y)
      const origBottom = orig.y // lower-left y = bottom in screen coords

      // Derive new lower-left from anchored edges (already on-grid)
      let finalX: number
      if (Math.abs(visualLeft - origLeft) < Math.abs(visualRight - origRight)) {
        finalX = origLeft // left edge anchored
      } else {
        finalX = origRight - newW // right edge anchored
      }

      let finalY: number
      if (Math.abs(visualTop - origTop) < Math.abs(visualBottom - origBottom)) {
        // Top edge anchored → bottom (lower-left y) = top + newH
        finalY = origTop + newH
      } else {
        finalY = origBottom // bottom edge anchored
      }

      // Reset scale
      this.konvaGroup.scaleX(1)
      this.konvaGroup.scaleY(1)

      // Collision check
      const proposed = { x: finalX, y: finalY, width: newW, height: newH }
      const collider = checkGroupCollision(proposed, this.groupId, this.deps.getAllGroups())
      if (collider) {
        // Revert to pre-resize state — no flash since this is expected prevention
        this.konvaGroup.position({ x: orig.x + orig.width / 2, y: orig.y - orig.height / 2 })
        this.deps.getTransformer()?.forceUpdate()
        this.preResizeBounds = null
        this.onCollisionRejected?.(this.groupId, 'resize')
        return
      }

      // Commit the new size
      this.width = newW
      this.height = newH

      // Update bg rect
      const bgRect = this.konvaGroup.findOne('.__groupBg')
      if (bgRect) {
        bgRect.setAttrs({ x: -newW / 2, y: -newH / 2, width: newW, height: newH })
      }

      // Reposition centroid from the final lower-left
      this.konvaGroup.position({ x: finalX + newW / 2, y: finalY - newH / 2 })

      this.refreshTransformerIfSelected()
      this.deps.layer.batchDraw()
      this.preResizeBounds = null

      this.onResized?.(this.groupId, finalX, finalY, newW, newH)
    })
  }

  private refreshTransformerIfSelected(): void {
    const transformer = this.deps.getTransformer()
    if (!transformer) return
    const selectedNodes = transformer.nodes()
    if (selectedNodes.some((n) => n.id() === this.groupId)) {
      transformer.forceUpdate()
    }
  }

  /** Toggle ghost preview during resize: hide decorations, fade fill. */
  private setResizeGhost(ghost: boolean): void {
    const decorations = this.konvaGroup.find('.__binArtwork')
    for (const node of decorations) {
      node.visible(!ghost)
    }
    const bgRect = this.konvaGroup.findOne('.__groupBg') as Konva.Rect | undefined
    if (bgRect) {
      bgRect.opacity(ghost ? 0.4 : 1)
    }
    this.deps.layer.batchDraw()
  }

  /** Brief red flash on the group border to indicate a collision rejection. */
  private flashCollision(): void {
    const bgRect = this.konvaGroup.findOne('.__groupBg') as Konva.Rect | undefined
    if (!bgRect) return
    const origStroke = bgRect.stroke()
    const origStrokeWidth = bgRect.strokeWidth()
    bgRect.stroke('#ef4444')
    bgRect.strokeWidth(2)
    this.deps.layer.batchDraw()
    setTimeout(() => {
      bgRect.stroke(origStroke ?? '#666666')
      bgRect.strokeWidth(origStrokeWidth ?? 1)
      this.deps.layer.batchDraw()
    }, 300)
  }

  /** Full transformer reset for decoration changes (clears NODES_RECT cache). */
  private refreshTransformerForDecorations(): void {
    const transformer = this.deps.getTransformer()
    if (!transformer) return
    const selectedNodes = transformer.nodes()
    if (selectedNodes.some((n) => n.id() === this.groupId)) {
      transformer.nodes([])
      transformer.nodes(selectedNodes)
    }
  }
}
