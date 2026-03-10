import Konva from 'konva'
import mitt from 'mitt'
import type { LayoutEngine } from './interface'
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
import { registerEngine } from './create-engine'
import { KonvaGroupRenderer } from './konva-group-renderer'
import { checkGroupCollision } from './collision'
import type { HitResult } from './input-action-handler'

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_BG = '#18181b'
const DEFAULT_GRID_COLOR = '#27272a'
const DEFAULT_GRID_ORIGIN = 'rgba(113, 113, 122, 0.35)'
const GRID_EXTENT = 10000

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute the bounding-box center of a polygon's points.
 * Used to set Konva.Line offset so that x,y = bbox center, matching
 * Fabric's originX/Y:'center' convention.
 */
function polygonBboxCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

function layoutShapeToKonva(shape: LayoutShape): Konva.Shape {
  let node: Konva.Shape

  switch (shape.type) {
    case 'rect':
      node = new Konva.Rect({
        width: shape.width,
        height: shape.height,
        cornerRadius: shape.cornerRadius ?? 0,
        // Offset so x,y = centroid
        offsetX: shape.width / 2,
        offsetY: shape.height / 2
      })
      break
    case 'circle':
      // Konva ellipses are center-based by default — matches centroid convention
      node = new Konva.Ellipse({
        radiusX: shape.radiusX,
        radiusY: shape.radiusY
      })
      break
    case 'polygon': {
      const c = polygonBboxCenter(shape.points)
      node = new Konva.Line({
        points: shape.points.flatMap((p) => [p.x, p.y]),
        closed: true,
        offsetX: c.x,
        offsetY: c.y
      })
      break
    }
    case 'svgPath':
      node = new Konva.Path({
        data: shape.pathData
      })
      break
    case 'meshImport':
      node = new Konva.Rect({
        width: 100,
        height: 100,
        offsetX: 50,
        offsetY: 50
      })
      break
  }

  node.setAttrs({
    id: shape.id,
    name: 'shape',
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeScaleEnabled: false,
    scaleX: shape.scaleX ?? 1,
    scaleY: shape.scaleY ?? 1,
    draggable: true
  })

  return node
}

// ─── KonvaEngine ────────────────────────────────────────────────────────────────

export class KonvaEngine implements LayoutEngine {
  private stage: Konva.Stage | null = null
  private mainLayer: Konva.Layer | null = null
  private gridLayer: Konva.Layer | null = null
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private emitter = mitt<EngineEventMap>()
  private interacting = false
  private _dragEnabled = true
  private transformer: Konva.Transformer | null = null

  // Internal state maps
  private shapeMap = new Map<string, LayoutShape>()
  private konvaMap = new Map<string, Konva.Shape>()
  private groupMap = new Map<string, LayoutGroup>()
  private rendererMap = new Map<string, KonvaGroupRenderer>()
  private gridConfig: GridConfig = { size: 42, enabled: true, visible: true }
  private themeColors = {
    background: DEFAULT_BG,
    grid: DEFAULT_GRID_COLOR,
    gridOrigin: DEFAULT_GRID_ORIGIN
  }
  private bgRect: Konva.Rect | null = null
  private gridBgRect: Konva.Rect | null = null
  private insets: ViewportInsets = {}

  // Pan/zoom, click-select, and rubber-band now handled by GestureRecognizer (#226)

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  mount(container: HTMLDivElement): void {
    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    this.stage = new Konva.Stage({
      container,
      width,
      height
    })

    this.gridLayer = new Konva.Layer({ listening: false })
    this.mainLayer = new Konva.Layer()

    this.stage.add(this.gridLayer)
    this.stage.add(this.mainLayer)

    // Create transformer
    this.transformer = new Konva.Transformer({
      keepRatio: false,
      borderStroke: '#60a5fa',
      borderStrokeWidth: 1.5,
      borderDash: [4, 3],
      anchorStroke: '#60a5fa',
      anchorFill: '#18181b',
      anchorSize: 8,
      anchorCornerRadius: 2,
      rotateAnchorOffset: 20,
      padding: 2
    })
    this.mainLayer.add(this.transformer)

    // Visible background on grid layer (beneath grid lines)
    this.gridBgRect = new Konva.Rect({
      x: -GRID_EXTENT,
      y: -GRID_EXTENT,
      width: GRID_EXTENT * 2,
      height: GRID_EXTENT * 2,
      fill: this.themeColors.background,
      listening: false
    })
    this.gridLayer.add(this.gridBgRect)

    // Transparent click-detection rect on main layer
    this.bgRect = new Konva.Rect({
      x: -GRID_EXTENT,
      y: -GRID_EXTENT,
      width: GRID_EXTENT * 2,
      height: GRID_EXTENT * 2,
      fill: 'transparent',
      listening: true,
      name: 'background'
    })
    this.mainLayer.add(this.bgRect)
    this.bgRect.moveToBottom()

    this.drawGrid()
    this.setupEventHandlers()

    // Center origin in the visible (unoccluded) area of the viewport
    this.centerOrigin()

    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.disposed || !this.stage) return
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        this.stage.width(w)
        this.stage.height(h)
        this.redrawGrid()
      }
    })
    this.resizeObserver.observe(container)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.emitter.all.clear()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.stage) {
      this.stage.destroy()
      this.stage = null
    }

    this.mainLayer = null
    this.gridLayer = null
    this.transformer = null
    this.shapeMap.clear()
    this.konvaMap.clear()
    this.groupMap.clear()
    this.rendererMap.clear()
  }

  resize(width: number, height: number): void {
    if (!this.stage || this.disposed) return
    this.stage.width(width)
    this.stage.height(height)
    this.redrawGrid()
  }

  // ─── Shape CRUD ─────────────────────────────────────────────────────────────

  addShape(shape: LayoutShape): void {
    if (this.disposed || !this.mainLayer) return
    const node = layoutShapeToKonva(shape)
    this.shapeMap.set(shape.id, { ...shape })
    this.konvaMap.set(shape.id, node)

    // Shapes move freely — no grid snap (only bins snap to the bin grid).

    node.on('dragend', () => {
      const data = this.shapeMap.get(shape.id)
      if (data) {
        data.x = node.x()
        data.y = node.y()
      }
      this.emitter.emit('shapeMoved', { id: shape.id, x: node.x(), y: node.y() })
    })

    // Rects and ellipses: reset scale live so they stay crisp and corner radii don't distort.
    // Polygons/paths are natively vector — let them keep scale.
    const resetScaleForPrimitives = (): void => {
      const data = this.shapeMap.get(shape.id)
      if (!data) return
      const sx = node.scaleX()
      const sy = node.scaleY()
      if (sx === 1 && sy === 1) return

      if (data.type === 'rect') {
        node.scaleX(1)
        node.scaleY(1)
        data.width = (node as Konva.Rect).width() * sx
        data.height = (node as Konva.Rect).height() * sy
        ;(node as Konva.Rect).width(data.width)
        ;(node as Konva.Rect).height(data.height)
        node.offsetX(data.width / 2)
        node.offsetY(data.height / 2)
      } else if (data.type === 'circle') {
        node.scaleX(1)
        node.scaleY(1)
        const ellipse = node as Konva.Ellipse
        data.radiusX = ellipse.radiusX() * sx
        data.radiusY = ellipse.radiusY() * sy
        ellipse.radiusX(data.radiusX)
        ellipse.radiusY(data.radiusY)
      }
    }

    node.on('transform', resetScaleForPrimitives)

    node.on('transformend', () => {
      resetScaleForPrimitives()

      const data = this.shapeMap.get(shape.id)
      if (!data) return
      data.x = node.x()
      data.y = node.y()
      data.rotation = node.rotation()

      if (data.type === 'rect') {
        this.emitter.emit('shapeResized', { id: shape.id, width: data.width, height: data.height })
      } else if (data.type === 'circle') {
        this.emitter.emit('shapeResized', {
          id: shape.id,
          radiusX: data.radiusX,
          radiusY: data.radiusY
        })
      } else if (data.type === 'polygon') {
        const sx = node.scaleX()
        const sy = node.scaleY()
        const pts = (node as Konva.Line).points()
        data.points = []
        for (let i = 0; i < pts.length; i += 2) {
          data.points.push({ x: pts[i] * sx, y: pts[i + 1] * sy })
        }
      }
      // svgPath/meshImport: scale tracked implicitly
    })

    if (shape.groupId && this.rendererMap.has(shape.groupId)) {
      this.rendererMap.get(shape.groupId)!.konvaGroup.add(node)
    } else {
      this.mainLayer.add(node)
      // Keep transformer on top
      this.transformer?.moveToTop()
    }

    this.mainLayer.batchDraw()
    this.emitter.emit('shapeCreated', { shape: { ...shape } })
  }

  updateShape(id: string, patch: Partial<LayoutShape>): void {
    if (this.disposed) return
    const existing = this.shapeMap.get(id)
    if (!existing) return

    const updated = { ...existing, ...patch, id } as LayoutShape
    this.shapeMap.set(id, updated)

    const node = this.konvaMap.get(id)
    if (!node) return

    const attrs: Record<string, unknown> = {}
    if (patch.x !== undefined) attrs.x = patch.x
    if (patch.y !== undefined) attrs.y = patch.y
    if (patch.rotation !== undefined) attrs.rotation = patch.rotation
    if (patch.fill !== undefined) attrs.fill = patch.fill
    if (patch.stroke !== undefined) attrs.stroke = patch.stroke
    if (patch.strokeWidth !== undefined) attrs.strokeWidth = patch.strokeWidth
    if ('width' in patch && patch.width !== undefined) attrs.width = patch.width
    if ('height' in patch && patch.height !== undefined) attrs.height = patch.height
    if ('radiusX' in patch && patch.radiusX !== undefined) attrs.radiusX = patch.radiusX
    if ('radiusY' in patch && patch.radiusY !== undefined) attrs.radiusY = patch.radiusY

    // Update rect offset when dimensions change (centroid convention)
    if (updated.type === 'rect') {
      if ('width' in patch || 'height' in patch) {
        attrs.offsetX = updated.width / 2
        attrs.offsetY = updated.height / 2
      }
    }

    node.setAttrs(attrs)

    // If lockAspectRatio changed and this node is selected, update transformer
    if (patch.lockAspectRatio !== undefined && this.transformer) {
      const selectedIds = this.getSelectedIds()
      if (selectedIds.includes(id)) {
        const shouldLock =
          selectedIds.length > 0 &&
          selectedIds.every((sid) => this.shapeMap.get(sid)?.lockAspectRatio === true)
        this.transformer.keepRatio(shouldLock)
      }
    }

    this.mainLayer?.batchDraw()
  }

  removeShape(id: string): void {
    if (this.disposed) return
    const node = this.konvaMap.get(id)
    if (!node) return

    const shape = this.shapeMap.get(id)
    if (shape?.groupId) {
      const group = this.groupMap.get(shape.groupId)
      if (group) {
        group.childIds = group.childIds.filter((cid) => cid !== id)
      }
    }

    node.destroy()
    this.shapeMap.delete(id)
    this.konvaMap.delete(id)
    this.mainLayer?.batchDraw()
    this.emitter.emit('shapeDeleted', { id })
  }

  getShape(id: string): LayoutShape | undefined {
    const data = this.shapeMap.get(id)
    if (!data) return undefined

    const node = this.konvaMap.get(id)
    if (!node) return { ...data }

    const result = { ...data }
    result.x = node.x()
    result.y = node.y()
    result.rotation = node.rotation()
    const sx = node.scaleX()
    const sy = node.scaleY()

    if (result.type === 'rect') {
      result.width = (node as Konva.Rect).width() * sx
      result.height = (node as Konva.Rect).height() * sy
    } else if (result.type === 'circle') {
      result.radiusX = (node as Konva.Ellipse).radiusX() * sx
      result.radiusY = (node as Konva.Ellipse).radiusY() * sy
    } else if (result.type === 'polygon') {
      const pts = (node as Konva.Line).points()
      result.points = []
      for (let i = 0; i < pts.length; i += 2) {
        result.points.push({ x: pts[i] * sx, y: pts[i + 1] * sy })
      }
    } else if (sx !== 1 || sy !== 1) {
      // svgPath/meshImport: persist scale for faithful roundtrip
      result.scaleX = sx
      result.scaleY = sy
    }

    return result
  }

  getAllShapes(): LayoutShape[] {
    return Array.from(this.shapeMap.keys()).map((id) => this.getShape(id)!)
  }

  // ─── Group Operations ──────────────────────────────────────────────────────

  createGroup(group: LayoutGroup): void {
    if (this.disposed || !this.mainLayer) return
    this.groupMap.set(group.id, { ...group })

    const renderer = new KonvaGroupRenderer(
      group,
      {
        layer: this.mainLayer,
        getGridConfig: () => this.gridConfig,
        getTransformer: () => this.transformer,
        getAllGroups: () => this.getAllGroups(),
        finalizeMultiSelectDrag: () => this.finalizeMultiSelectDrag()
      },
      (id, x, y) => {
        const g = this.groupMap.get(id)
        if (g) {
          g.x = x
          g.y = y
        }
        this.emitter.emit('groupMoved', { id, x, y })
      },
      (id, x, y, width, height) => {
        const g = this.groupMap.get(id)
        if (g) {
          g.x = x
          g.y = y
          g.width = width
          g.height = height
          // Update bin metadata units if this is a bin group
          const meta = g.metadata as Record<string, unknown> | undefined
          if (meta && typeof meta.widthUnits === 'number') {
            meta.widthUnits = Math.round(width / this.gridConfig.size)
            meta.depthUnits = Math.round(height / this.gridConfig.size)
          }
        }
        this.emitter.emit('groupResized', { id, width, height })
        this.emitter.emit('groupChanged', { groupId: id, childIds: [...(g?.childIds ?? [])] })
      },
      (id, reason) => {
        this.emitter.emit('collisionRejected', { id, reason })
      }
    )
    this.rendererMap.set(group.id, renderer)

    // Capture pre-drag positions for all selected nodes when any group starts dragging
    renderer.konvaGroup.on('dragstart', () => {
      this.capturePreDragPositions()
    })

    // Move children into group (positions relative to group centroid)
    const centroidX = group.x + group.width / 2
    const centroidY = group.y - group.height / 2
    for (const childId of group.childIds) {
      const node = this.konvaMap.get(childId)
      if (node) {
        const absX = node.x()
        const absY = node.y()
        node.moveTo(renderer.konvaGroup)
        node.position({ x: absX - centroidX, y: absY - centroidY })
      }
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = group.id
    }

    this.mainLayer.add(renderer.konvaGroup)
    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
    this.emitter.emit('groupChanged', { groupId: group.id, childIds: [...group.childIds] })
  }

  updateGroup(id: string, patch: Partial<LayoutGroup>): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return
    const renderer = this.rendererMap.get(id)
    if (!renderer) return

    Object.assign(group, patch, { id })
    renderer.update(patch, group)
    this.emitter.emit('groupChanged', { groupId: id, childIds: [...group.childIds] })
  }

  removeGroup(id: string): void {
    if (this.disposed || !this.mainLayer) return
    const group = this.groupMap.get(id)
    if (!group) return

    const renderer = this.rendererMap.get(id)
    if (renderer) {
      // Ungroup: move children back to main layer at world-space positions
      const children = [...renderer.konvaGroup.getChildren()]
      for (const child of children) {
        if (child.name() !== 'shape') continue
        const absPos = child.getAbsolutePosition()
        child.moveTo(this.mainLayer)
        child.position(absPos)
      }
      renderer.destroy()
    }

    for (const childId of group.childIds) {
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = null
    }

    this.groupMap.delete(id)
    this.rendererMap.delete(id)
    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
    this.emitter.emit('groupChanged', { groupId: id, childIds: [] })
  }

  addToGroup(shapeId: string, groupId: string): void {
    if (this.disposed) return
    const group = this.groupMap.get(groupId)
    const renderer = this.rendererMap.get(groupId)
    const node = this.konvaMap.get(shapeId)
    const shape = this.shapeMap.get(shapeId)

    if (!group || !renderer || !node || !shape) return

    const absX = node.x()
    const absY = node.y()
    node.moveTo(renderer.konvaGroup)
    node.position({ x: absX - renderer.konvaGroup.x(), y: absY - renderer.konvaGroup.y() })

    group.childIds = [...group.childIds, shapeId]
    shape.groupId = groupId

    this.mainLayer?.batchDraw()
  }

  removeFromGroup(shapeId: string): void {
    if (this.disposed || !this.mainLayer) return
    const shape = this.shapeMap.get(shapeId)
    if (!shape?.groupId) return

    const group = this.groupMap.get(shape.groupId)
    const renderer = this.rendererMap.get(shape.groupId)
    const node = this.konvaMap.get(shapeId)

    if (!group || !renderer || !node) return

    const absPos = node.getAbsolutePosition()
    node.moveTo(this.mainLayer)
    node.position(absPos)

    group.childIds = group.childIds.filter((id) => id !== shapeId)
    shape.groupId = null

    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
  }

  setGroupDecorations(groupId: string, decorations: GroupDecoration[]): void {
    if (this.disposed) return
    const renderer = this.rendererMap.get(groupId)
    if (!renderer) return
    renderer.setDecorations(decorations)
  }

  getGroup(id: string): LayoutGroup | undefined {
    const group = this.groupMap.get(id)
    if (!group) return undefined
    const renderer = this.rendererMap.get(id)
    if (renderer) {
      const pos = renderer.readPosition()
      return { ...group, x: pos.x, y: pos.y, rotation: pos.rotation }
    }
    return { ...group }
  }

  getAllGroups(): LayoutGroup[] {
    return Array.from(this.groupMap.keys()).map((id) => this.getGroup(id)!)
  }

  // ─── Multi-Select Drag Support ──────────────────────────────────────────────

  /** Pre-drag positions for all nodes in the selection, keyed by node ID. */
  private preDragPositions = new Map<string, { x: number; y: number }>()

  /** Idempotent guard: ensures only one finalization per drag batch. */
  private multiDragFinalized = false

  /** Guard: ensures only the first dragstart per batch captures positions. */
  private preDragCaptured = false

  /**
   * Capture pre-drag positions for all selected nodes. Called on dragstart.
   *
   * Each node in the Transformer fires its own dragstart. If we recaptured
   * on every one, later dragstart events could read positions that the
   * Transformer already started moving — causing cumulative drift on revert.
   * The guard ensures only the first dragstart captures; the microtask
   * resets the guard after the synchronous dragstart batch completes.
   */
  private capturePreDragPositions(): void {
    if (this.preDragCaptured) return
    this.preDragCaptured = true
    queueMicrotask(() => {
      this.preDragCaptured = false
    })

    this.preDragPositions.clear()
    this.multiDragFinalized = false
    const nodes = this.transformer?.nodes() ?? []
    for (const node of nodes) {
      this.preDragPositions.set(node.id(), { x: node.x(), y: node.y() })
    }
  }

  /**
   * Atomically finalize a multi-select drag: snap, collision-check, then
   * either commit all data model changes or revert the entire selection.
   *
   * Called from each group renderer's dragend — idempotent, only the first
   * call per drag batch does actual work.
   *
   * Sequence:
   * 1. Snap the first group to grid, compute the snap delta
   * 2. Apply that delta to all other selected groups (positions only, no data model)
   * 3. Check collision for every group against non-selected groups
   * 4. Collision → revert all nodes to pre-drag positions, flash red
   * 5. No collision → update data model (groupMap + shapeMap), emit events
   */
  private finalizeMultiSelectDrag(): void {
    if (this.multiDragFinalized) return
    this.multiDragFinalized = true

    const nodes = this.transformer?.nodes() ?? []
    if (nodes.length <= 1) return

    const gridConfig = this.gridConfig

    // Collect selected group IDs for collision exclusion
    const selectedIds = new Set<string>()
    for (const node of nodes) {
      if (node.name() === 'group') selectedIds.add(node.id())
    }

    // Step 1: Snap the first group and compute delta
    let snapDx = 0
    let snapDy = 0
    if (gridConfig.enabled) {
      for (const node of nodes) {
        if (node.name() !== 'group') continue
        const renderer = this.rendererMap.get(node.id())
        if (!renderer) continue
        const preSnapX = node.x()
        const preSnapY = node.y()
        renderer.snapToGrid(gridConfig.size)
        snapDx = node.x() - preSnapX
        snapDy = node.y() - preSnapY
        break // only use the first group to compute delta
      }
    }

    // Step 2: Apply snap delta to all OTHER selected groups (Konva positions only, no data model).
    // Skip shapes — they are children of group Konva nodes and move with their parent.
    if (snapDx !== 0 || snapDy !== 0) {
      let firstGroup = true
      for (const node of nodes) {
        if (node.name() !== 'group') continue // skip shapes (they move with parent)
        if (firstGroup) {
          firstGroup = false
          continue // skip the already-snapped group
        }
        node.position({ x: node.x() + snapDx, y: node.y() + snapDy })
      }
      this.transformer?.forceUpdate()
      this.mainLayer?.batchDraw()
    }

    // Step 3: Check collision for ALL groups in selection
    let hasCollision = false
    for (const node of nodes) {
      if (node.name() !== 'group') continue
      const renderer = this.rendererMap.get(node.id())
      if (!renderer) continue
      const pos = renderer.readPosition()
      const group = this.groupMap.get(node.id())
      if (!group) continue

      const proposed = { x: pos.x, y: pos.y, width: group.width, height: group.height }
      if (checkGroupCollision(proposed, node.id(), this.getAllGroups(), selectedIds)) {
        hasCollision = true
        break
      }
    }

    // Step 4: Collision → revert all nodes to pre-drag, flash, done
    if (hasCollision) {
      for (const node of nodes) {
        const pre = this.preDragPositions.get(node.id())
        if (pre) node.position(pre)
      }
      this.transformer?.forceUpdate()
      this.mainLayer?.batchDraw()

      // Flash collision on all group renderers and emit events
      for (const node of nodes) {
        if (node.name() !== 'group') continue
        this.rendererMap.get(node.id())?.flashCollision()
        this.emitter.emit('collisionRejected', { id: node.id(), reason: 'move' })
      }
      return
    }

    // Step 5: No collision → commit all data model updates, emit events
    for (const node of nodes) {
      const id = node.id()
      if (node.name() === 'group') {
        const renderer = this.rendererMap.get(id)
        if (!renderer) continue
        const pos = renderer.readPosition()
        const g = this.groupMap.get(id)
        if (g) {
          g.x = pos.x
          g.y = pos.y
        }
        this.emitter.emit('groupMoved', { id, x: pos.x, y: pos.y })
      } else {
        const data = this.shapeMap.get(id)
        if (data) {
          data.x = node.x()
          data.y = node.y()
        }
        this.emitter.emit('shapeMoved', { id, x: node.x(), y: node.y() })
      }
    }
  }

  // ─── Selection ──────────────────────────────────────────────────────────────

  select(ids: string[]): void {
    if (this.disposed || !this.transformer) return

    const nodes = ids
      .map(
        (id) =>
          (this.konvaMap.get(id) as Konva.Node) ??
          (this.rendererMap.get(id)?.konvaGroup as Konva.Node)
      )
      .filter((n): n is Konva.Node => n !== undefined)

    const groupIds = ids.filter((id) => this.rendererMap.has(id))
    const isSingleBin = groupIds.length === 1 && ids.length === 1

    this.transformer.nodes(nodes)

    if (isSingleBin) {
      // Single bin: enable resize, disable rotate
      this.transformer.resizeEnabled(true)
      this.transformer.rotateEnabled(false)
      this.transformer.keepRatio(false)
    } else if (groupIds.length > 0) {
      // Multi-select with bins: disable resize and rotate
      this.transformer.resizeEnabled(false)
      this.transformer.rotateEnabled(false)
    } else {
      this.transformer.resizeEnabled(true)
      this.transformer.rotateEnabled(true)
      // Lock ratio only when ALL selected shapes have lockAspectRatio explicitly set
      const shouldLock =
        ids.length > 0 && ids.every((id) => this.shapeMap.get(id)?.lockAspectRatio === true)
      this.transformer.keepRatio(shouldLock)
    }

    this.mainLayer?.batchDraw()
    this.emitter.emit('selectionChanged', { ids: [...ids] })
  }

  selectIds(ids: string[]): void {
    this.select(ids)
  }

  addToSelection(ids: string[]): void {
    if (this.disposed || !this.transformer) return
    const currentNodes = this.transformer.nodes()
    const currentIds = currentNodes.map((n) => n.id())
    const merged = [...new Set([...currentIds, ...ids])]
    this.select(merged)
  }

  removeFromSelection(ids: string[]): void {
    if (this.disposed || !this.transformer) return
    const currentIds = this.transformer.nodes().map((n) => n.id())
    const remaining = currentIds.filter((id) => !ids.includes(id))
    this.select(remaining)
  }

  clearSelection(): void {
    if (this.disposed || !this.transformer) return
    this.transformer.nodes([])
    this.mainLayer?.batchDraw()
    this.emitter.emit('selectionChanged', { ids: [] })
  }

  getSelectedIds(): string[] {
    if (!this.transformer) return []
    return this.transformer.nodes().map((n) => n.id())
  }

  // ─── Viewport ───────────────────────────────────────────────────────────────

  panTo(x: number, y: number): void {
    if (this.disposed || !this.stage) return
    this.stage.position({ x: -x, y: -y })
    this.stage.batchDraw()
    this.emitter.emit('viewportChanged', {
      panX: x,
      panY: y,
      zoom: this.stage.scaleX()
    })
  }

  zoomTo(level: number, center?: { x: number; y: number }): void {
    if (this.disposed || !this.stage) return
    const clamped = Math.max(0.1, Math.min(10, level))

    if (center) {
      const oldScale = this.stage.scaleX()
      const mousePointTo = {
        x: (center.x - this.stage.x()) / oldScale,
        y: (center.y - this.stage.y()) / oldScale
      }
      this.stage.scale({ x: clamped, y: clamped })
      this.stage.position({
        x: center.x - mousePointTo.x * clamped,
        y: center.y - mousePointTo.y * clamped
      })
    } else {
      this.stage.scale({ x: clamped, y: clamped })
    }

    this.stage.batchDraw()
    const vp = this.getViewport()
    this.emitter.emit('viewportChanged', vp)
  }

  resetView(): void {
    if (this.disposed || !this.stage) return
    this.centerOrigin()
    this.stage.batchDraw()
    const vp = this.getViewport()
    this.emitter.emit('viewportChanged', vp)
  }

  getViewport(): ViewportState {
    if (!this.stage) return { panX: 0, panY: 0, zoom: 1 }
    return {
      panX: -this.stage.x() || 0,
      panY: -this.stage.y() || 0,
      zoom: this.stage.scaleX()
    }
  }

  setViewportInsets(insets: ViewportInsets): void {
    const prev = this.insets
    if (prev.left === insets.left && prev.bottom === insets.bottom) return
    this.insets = insets
    if (this.stage && !this.disposed) {
      this.centerOrigin()
      this.stage.batchDraw()
      const vp = this.getViewport()
      this.emitter.emit('viewportChanged', vp)
    }
  }

  // ─── Grid ───────────────────────────────────────────────────────────────────

  setGridConfig(config: Partial<GridConfig>): void {
    Object.assign(this.gridConfig, config)
    this.redrawGrid()
  }

  getGridConfig(): GridConfig {
    return { ...this.gridConfig }
  }

  // ─── Theme ───────────────────────────────────────────────────────────────

  setThemeColors(colors: { background: string; grid: string; gridOrigin: string }): void {
    this.themeColors = colors
    if (this.gridBgRect) {
      this.gridBgRect.fill(colors.background)
    }
    this.redrawGrid()
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  on<K extends keyof EngineEventMap>(
    event: K,
    handler: (payload: EngineEventMap[K]) => void
  ): () => void {
    this.emitter.on(event, handler)
    return () => this.emitter.off(event, handler)
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  toSnapshot(): LayoutSnapshot {
    return {
      version: '1.0.0',
      shapes: this.getAllShapes(),
      groups: this.getAllGroups(),
      gridConfig: this.getGridConfig()
    }
  }

  loadSnapshot(snapshot: LayoutSnapshot): void {
    if (this.disposed) return

    for (const id of [...this.shapeMap.keys()]) {
      this.removeShape(id)
    }
    for (const id of [...this.groupMap.keys()]) {
      this.removeGroup(id)
    }

    this.setGridConfig(snapshot.gridConfig)

    const ungrouped = snapshot.shapes.filter((s) => !s.groupId)
    const grouped = snapshot.shapes.filter((s) => s.groupId)

    for (const shape of ungrouped) {
      this.addShape(shape)
    }
    for (const group of snapshot.groups) {
      this.createGroup(group)
    }
    for (const shape of grouped) {
      this.addShape(shape)
    }
  }

  // ─── Transient State ────────────────────────────────────────────────────────

  getTransientState(): TransientState {
    return {
      selectedIds: this.getSelectedIds(),
      viewport: this.getViewport()
    }
  }

  setTransientState(state: TransientState): void {
    this.panTo(state.viewport.panX, state.viewport.panY)
    this.zoomTo(state.viewport.zoom)
    // Don't restore selection — transformer state doesn't survive engine switches cleanly
  }

  // ─── Capabilities ───────────────────────────────────────────────────────────

  capabilities(): Set<string> {
    return new Set(['rect', 'circle', 'polygon', 'svgPath', 'meshImport', 'group', 'selection'])
  }

  // ─── Interaction State ──────────────────────────────────────────────────────

  isInteracting(): boolean {
    return this.interacting
  }

  // ─── Input Action Handler ─────────────────────────────────────────────────

  applyPan(dx: number, dy: number): void {
    if (this.disposed || !this.stage) return
    this.stage.position({
      x: this.stage.x() + dx,
      y: this.stage.y() + dy
    })
    this.stage.batchDraw()
    this.emitter.emit('viewportChanged', this.getViewport())
  }

  applyZoom(delta: number, centerX: number, centerY: number): void {
    if (this.disposed || !this.stage) return
    const oldScale = this.stage.scaleX()
    const scaleBy = 1.08
    const direction = delta > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    this.zoomTo(newScale, { x: centerX, y: centerY })
  }

  setDragEnabled(enabled: boolean): void {
    if (this.disposed || this._dragEnabled === enabled) return
    this._dragEnabled = enabled
    for (const node of this.konvaMap.values()) {
      node.draggable(enabled)
    }
    for (const renderer of this.rendererMap.values()) {
      renderer.konvaGroup.draggable(enabled)
    }
  }

  objectAt(worldX: number, worldY: number): HitResult | null {
    if (!this.stage) return null
    const scale = this.stage.scaleX()
    const pos = this.stage.position()
    const screenX = worldX * scale + pos.x
    const screenY = worldY * scale + pos.y

    const node = this.stage.getIntersection({ x: screenX, y: screenY })
    if (!node) return null

    // Walk up to find a tagged node or Transformer
    let current: Konva.Node | null = node
    while (current) {
      const name = current.name()
      if (name === 'shape' || name === 'group') {
        return {
          type: name === 'shape' ? 'shape' : 'group',
          id: current.id()
        }
      }
      if (name === '__groupBg' && current.parent) {
        const parentId = current.parent.id()
        if (this.rendererMap.has(parentId)) {
          return { type: 'group', id: parentId }
        }
      }
      // Transformer anchors: resolve to the first transformed node
      if (current instanceof Konva.Transformer) {
        const nodes = current.nodes()
        if (nodes.length > 0) {
          const primary = nodes[0]
          const pName = primary.name()
          if (pName === 'shape' || pName === 'group') {
            return { type: pName === 'shape' ? 'shape' : 'group', id: primary.id() }
          }
        }
      }
      current = current.parent
    }

    return null
  }

  objectsInRect(rect: { x: number; y: number; width: number; height: number }): HitResult[] {
    if (!this.stage) return []
    const scale = this.stage.scaleX()
    const pos = this.stage.position()

    // Convert world-space rect to screen-space for getClientRect() comparison
    const selBox = {
      x: rect.x * scale + pos.x,
      y: rect.y * scale + pos.y,
      width: rect.width * scale,
      height: rect.height * scale
    }

    const hits: HitResult[] = []

    for (const [id, node] of this.konvaMap) {
      const nodeBox = node.getClientRect()
      if (
        nodeBox.x < selBox.x + selBox.width &&
        nodeBox.x + nodeBox.width > selBox.x &&
        nodeBox.y < selBox.y + selBox.height &&
        nodeBox.y + nodeBox.height > selBox.y
      ) {
        hits.push({ type: 'shape', id })
      }
    }

    for (const [id, renderer] of this.rendererMap) {
      const nodeBox = renderer.konvaGroup.getClientRect()
      if (
        nodeBox.x < selBox.x + selBox.width &&
        nodeBox.x + nodeBox.width > selBox.x &&
        nodeBox.y < selBox.y + selBox.height &&
        nodeBox.y + nodeBox.height > selBox.y
      ) {
        hits.push({ type: 'group', id })
      }
    }

    return hits
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.stage) return { x: screenX, y: screenY }
    const scale = this.stage.scaleX()
    const pos = this.stage.position()
    return {
      x: (screenX - pos.x) / scale,
      y: (screenY - pos.y) / scale
    }
  }

  private rubberBandRect: Konva.Rect | null = null

  showRubberBand(rect: { x: number; y: number; width: number; height: number }): void {
    if (!this.mainLayer) return
    if (!this.rubberBandRect) {
      this.rubberBandRect = new Konva.Rect({
        fill: 'rgba(100, 150, 255, 0.1)',
        stroke: 'rgba(100, 150, 255, 0.6)',
        strokeWidth: 1,
        dash: [4, 4],
        listening: false
      })
      this.mainLayer.add(this.rubberBandRect)
    }
    this.rubberBandRect.setAttrs({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      visible: true
    })
    this.mainLayer.batchDraw()
  }

  hideRubberBand(): void {
    if (!this.rubberBandRect) return
    this.rubberBandRect.destroy()
    this.rubberBandRect = null
    this.mainLayer?.batchDraw()
  }

  // ─── Private: Viewport centering ────────────────────────────────────────────

  /**
   * Position the world origin near the bottom-left of the unoccluded stage
   * area with 1.5 grid-unit padding. Zoom is derived from grid size alone
   * (not viewport dimensions) so resizing the window changes how many cells
   * are visible, not how large they appear.
   */
  private centerOrigin(): void {
    if (!this.stage) return
    const h = this.stage.height()
    const l = this.insets.left ?? 0
    const b = this.insets.bottom ?? 0
    const gs = this.gridConfig.size
    // Target: each grid cell ≈ 64 screen pixels at default zoom
    const zoom = 64 / gs
    const pad = 1.5 * gs * zoom
    const ox = l + pad
    const oy = h - b - pad
    this.stage.scale({ x: zoom, y: zoom })
    this.stage.position({ x: ox, y: oy })
  }

  // ─── Private: Grid ──────────────────────────────────────────────────────────

  private drawGrid(): void {
    if (!this.gridLayer || !this.stage || !this.gridConfig.visible) return

    const size = this.gridConfig.size
    const sub = size / 4
    const { grid, gridOrigin } = this.themeColors
    const startMajor = Math.ceil(-GRID_EXTENT / size) * size
    const startSub = Math.ceil(-GRID_EXTENT / sub) * sub

    const addLine = (points: number[], stroke: string, strokeWidth: number, opacity = 1): void => {
      this.gridLayer!.add(
        new Konva.Line({ points, stroke, strokeWidth, listening: false, opacity })
      )
    }

    // Subdivision lines — start from aligned position
    for (let x = startSub; x <= GRID_EXTENT; x += sub) {
      if (Math.abs(x % size) < 0.001) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.25, 0.4)
    }
    for (let y = startSub; y <= GRID_EXTENT; y += sub) {
      if (Math.abs(y % size) < 0.001) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.25, 0.4)
    }

    // Major grid lines — start from aligned position
    for (let x = startMajor; x <= GRID_EXTENT; x += size) {
      if (x === 0) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.5)
    }
    for (let y = startMajor; y <= GRID_EXTENT; y += size) {
      if (y === 0) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.5)
    }

    // Origin crosshair stays at exact 0,0
    addLine([0, -GRID_EXTENT, 0, GRID_EXTENT], gridOrigin, 1.5)
    addLine([-GRID_EXTENT, 0, GRID_EXTENT, 0], gridOrigin, 1.5)

    this.gridLayer.batchDraw()
  }

  private redrawGrid(): void {
    if (!this.gridLayer) return
    this.gridLayer.destroyChildren()
    // Re-add the background rect to grid layer
    if (this.gridBgRect) {
      this.gridBgRect = new Konva.Rect({
        x: -GRID_EXTENT,
        y: -GRID_EXTENT,
        width: GRID_EXTENT * 2,
        height: GRID_EXTENT * 2,
        fill: this.themeColors.background,
        listening: false
      })
      this.gridLayer.add(this.gridBgRect)
    }
    this.drawGrid()
  }

  // ─── Private: Event handlers ────────────────────────────────────────────────

  private setupEventHandlers(): void {
    if (!this.stage) return

    // Click-select, rubber-band, and pan/zoom now handled by GestureRecognizer (#226).
    // Only interaction state tracking remains here — set interacting only when
    // an actual object is under the pointer (not empty canvas / background).
    this.stage.on('mousedown', (e) => {
      const t = e.target
      if (t && t !== this.stage && t !== this.bgRect) this.interacting = true
    })
    this.stage.on('mouseup', () => {
      this.interacting = false
    })
  }

  // ─── Private: Pan & Zoom ────────────────────────────────────────────────────

  // setupPanZoom removed — pan/zoom now handled by GestureRecognizer (#226)
}

// Auto-register
registerEngine('konva', KonvaEngine)
