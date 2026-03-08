import Konva from 'konva'
import type { GroupRenderer } from './group-renderer'
import type { LayoutGroup, GroupDecoration, GridConfig } from './types'

/**
 * Dependencies injected from the KonvaEngine.
 * Avoids tight coupling while giving the renderer access to engine state.
 */
export interface KonvaGroupRendererDeps {
  layer: Konva.Layer
  getGridConfig(): GridConfig
  getTransformer(): Konva.Transformer | null
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

  constructor(
    group: LayoutGroup,
    deps: KonvaGroupRendererDeps,
    onMoved: (id: string, x: number, y: number) => void
  ) {
    this.deps = deps
    this.onMoved = onMoved
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
      cornerRadius: group.style.cornerRadius ?? 0,
      listening: true,
      name: '__groupBg'
    })
    this.konvaGroup.add(bgRect)

    this.setupSnapHandlers()
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
    // Snap group lower-left corner to grid during drag.
    // Multi-select: skip live snap — Konva's Transformer fights per-node
    // corrections causing drift. Each bin snaps on dragend instead.
    this.konvaGroup.on('dragmove', () => {
      const gridConfig = this.deps.getGridConfig()
      if (!gridConfig.enabled) return
      const selectedNodes = this.deps.getTransformer()?.nodes() ?? []
      if (selectedNodes.length > 1) return

      this.snapToGrid(gridConfig.size)
    })

    // On drag end: snap and sync data model
    this.konvaGroup.on('dragend', () => {
      const gridConfig = this.deps.getGridConfig()
      if (gridConfig.enabled) {
        this.snapToGrid(gridConfig.size)
      }

      const pos = this.readPosition()
      this.onMoved(this.groupId, pos.x, pos.y)
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
