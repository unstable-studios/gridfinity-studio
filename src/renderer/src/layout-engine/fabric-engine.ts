import * as fabric from 'fabric'
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
import { FabricGroupRenderer } from './fabric-group-renderer'
import { checkGroupCollision } from './collision'
import type { HitResult } from './input-action-handler'
import { computeEdgeAnchor } from './input-math'
import { findContainingBinGroup } from './containment'

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_BG = '#18181b'
const DEFAULT_GRID_COLOR = 'rgba(113, 113, 122, 0.18)'
const DEFAULT_GRID_ORIGIN = 'rgba(113, 113, 122, 0.35)'
const SHAPE_DATA_KEY = '__layoutShapeId'
const GROUP_DATA_KEY = '__layoutGroupId'
const GRID_EXTENT = 10000

// ─── Helpers ────────────────────────────────────────────────────────────────────

function layoutShapeToFabric(shape: LayoutShape): fabric.FabricObject {
  let obj: fabric.FabricObject

  switch (shape.type) {
    case 'rect':
      obj = new fabric.Rect({
        width: shape.width,
        height: shape.height,
        rx: shape.cornerRadius ?? 0,
        ry: shape.cornerRadius ?? 0
      })
      break
    case 'circle':
      obj = new fabric.Ellipse({
        rx: shape.radiusX,
        ry: shape.radiusY
      })
      break
    case 'polygon':
      obj = new fabric.Polygon(shape.points.map((p) => ({ x: p.x, y: p.y })))
      break
    case 'svgPath':
      obj = new fabric.Path(shape.pathData)
      break
    case 'meshImport':
      // Mesh imports render as a placeholder rect
      obj = new fabric.Rect({
        width: 100,
        height: 100
      })
      break
  }

  obj.set({
    left: shape.x,
    top: shape.y,
    angle: shape.rotation,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeUniform: true,
    objectCaching: false,
    originX: 'center',
    originY: 'center',
    lockUniScaling: shape.lockAspectRatio ?? false,
    scaleX: shape.scaleX ?? 1,
    scaleY: shape.scaleY ?? 1
  })

  // Store shape ID on the fabric object for reverse lookup
  ;(obj as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] = shape.id

  return obj
}

function fabricObjToLayoutShape(obj: fabric.FabricObject, shapeData: LayoutShape): LayoutShape {
  const base = {
    id: shapeData.id,
    x: obj.left ?? 0,
    y: obj.top ?? 0,
    rotation: obj.angle ?? 0,
    fill: (obj.fill as string) ?? shapeData.fill,
    stroke: (obj.stroke as string) ?? shapeData.stroke,
    strokeWidth: obj.strokeWidth ?? shapeData.strokeWidth,
    groupId: shapeData.groupId,
    lockAspectRatio: shapeData.lockAspectRatio,
    metadata: shapeData.metadata
  }

  switch (shapeData.type) {
    case 'rect':
      return {
        ...base,
        type: 'rect',
        width: (obj as fabric.Rect).width * (obj.scaleX ?? 1),
        height: (obj as fabric.Rect).height * (obj.scaleY ?? 1),
        cornerRadius: shapeData.cornerRadius
      }
    case 'circle':
      return {
        ...base,
        type: 'circle',
        radiusX: (obj as fabric.Ellipse).rx * (obj.scaleX ?? 1),
        radiusY: (obj as fabric.Ellipse).ry * (obj.scaleY ?? 1)
      }
    case 'polygon': {
      // Read actual points from the Fabric polygon and apply any residual scale
      const poly = obj as fabric.Polygon
      const sx = obj.scaleX ?? 1
      const sy = obj.scaleY ?? 1
      const pts = (poly.points ?? []).map((p) => ({ x: p.x * sx, y: p.y * sy }))
      return { ...base, type: 'polygon', points: pts.length > 0 ? pts : shapeData.points }
    }
    case 'svgPath':
      return {
        ...base,
        type: 'svgPath',
        pathData: shapeData.pathData,
        viewBox: shapeData.viewBox,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1
      }
    case 'meshImport':
      return {
        ...base,
        type: 'meshImport',
        meshRef: shapeData.meshRef,
        silhouettePath: shapeData.silhouettePath,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1
      }
  }
}

// ─── FabricEngine ───────────────────────────────────────────────────────────────

export class FabricEngine implements LayoutEngine {
  private canvas: fabric.Canvas | null = null
  private container: HTMLDivElement | null = null
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private emitter = mitt<EngineEventMap>()
  private interacting = false

  // Internal state maps
  private shapeMap = new Map<string, LayoutShape>()
  private fabricMap = new Map<string, fabric.FabricObject>()
  private groupMap = new Map<string, LayoutGroup>()
  private rendererMap = new Map<string, FabricGroupRenderer>()
  /** Pre-drag/resize state for edge-anchoring during resize */
  private preDragState = new Map<
    string,
    {
      left: number
      top: number
      lowerLeftX: number
      lowerLeftY: number
      width: number
      height: number
    }
  >()
  /** Last known non-colliding position during drag, for live collision prevention */
  private lastGoodPos = new Map<string, { left: number; top: number }>()
  /** Non-scaling overlay rect shown during resize as ghost preview. */
  private resizeOverlay: fabric.Rect | null = null
  private resizeOverlayGroupId: string | null = null
  private gridLines: fabric.FabricObject[] = []
  private gridConfig: GridConfig = { size: 42, enabled: true, visible: true }
  private themeColors = {
    background: DEFAULT_BG,
    grid: DEFAULT_GRID_COLOR,
    gridOrigin: DEFAULT_GRID_ORIGIN
  }
  private insets: ViewportInsets = {}
  /** Currently highlighted group ID during shape drag (for drop-target feedback). */
  private highlightedGroupId: string | null = null
  /**
   * Suppresses the shape branch of `object:modified` while we're reparenting a
   * shape. Fabric's `canvas.remove`/`canvas.add` of the active object internally
   * calls `_discardActiveObject` → `_finalizeCurrentTransform`, which fires
   * `object:modified` again and would re-enter `evaluateShapeReassignment`
   * before `shape.groupId` is updated, double-pushing into `group.childIds`.
   */
  private reassigningShape = false

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  mount(container: HTMLDivElement): void {
    this.container = container
    const canvasEl = document.createElement('canvas')
    container.appendChild(canvasEl)

    const width = container.clientWidth || 800
    const height = container.clientHeight || 600

    this.canvas = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: this.themeColors.background,
      uniformScaling: false,
      selection: true,
      selectionColor: 'rgba(96, 165, 250, 0.08)',
      selectionBorderColor: '#60a5fa',
      selectionLineWidth: 1
    })

    this.setupEventHandlers()
    this.drawGrid()
    this.setupSnapToGrid()

    // Center origin in the visible (unoccluded) area of the viewport
    this.centerOrigin()

    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.disposed || !this.canvas) return
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        this.canvas.setDimensions({ width: w, height: h })
        this.redrawGrid()
        this.canvas.requestRenderAll()
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

    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }

    // Clean up all DOM elements created by Fabric
    if (this.container) {
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild)
      }
      this.container = null
    }

    this.shapeMap.clear()
    this.fabricMap.clear()
    this.groupMap.clear()
    this.rendererMap.clear()
  }

  resize(width: number, height: number): void {
    if (!this.canvas || this.disposed) return
    this.canvas.setDimensions({ width, height })
    this.redrawGrid()
    this.canvas.requestRenderAll()
  }

  // ─── Shape CRUD ─────────────────────────────────────────────────────────────

  addShape(shape: LayoutShape): void {
    if (this.disposed) return
    const obj = layoutShapeToFabric(shape)
    this.shapeMap.set(shape.id, { ...shape })
    this.fabricMap.set(shape.id, obj)

    if (shape.groupId && this.rendererMap.has(shape.groupId)) {
      // shape.x/y is already group-local (snapshot semantics). attachChild
      // bypasses fabric.Group.add() so we don't double-convert via
      // enterGroup or kick FitContentLayout into corrupting the bin bbox.
      this.rendererMap.get(shape.groupId)!.attachChild(obj)
    } else {
      this.canvas?.add(obj)
    }

    this.canvas?.requestRenderAll()
    this.emitter.emit('shapeCreated', { shape: { ...shape } })
  }

  updateShape(id: string, patch: Partial<LayoutShape>): void {
    if (this.disposed) return
    const existing = this.shapeMap.get(id)
    if (!existing) return

    const updated = { ...existing, ...patch, id } as LayoutShape
    this.shapeMap.set(id, updated)

    const obj = this.fabricMap.get(id)
    if (!obj) return

    if (patch.x !== undefined) obj.set('left', patch.x)
    if (patch.y !== undefined) obj.set('top', patch.y)
    if (patch.rotation !== undefined) obj.set('angle', patch.rotation)
    if (patch.fill !== undefined) obj.set('fill', patch.fill as string)
    if (patch.stroke !== undefined) obj.set('stroke', patch.stroke as string)
    if (patch.strokeWidth !== undefined) obj.set('strokeWidth', patch.strokeWidth)

    if ('width' in patch && patch.width !== undefined && obj instanceof fabric.Rect) {
      obj.set('width', patch.width)
    }
    if ('height' in patch && patch.height !== undefined && obj instanceof fabric.Rect) {
      obj.set('height', patch.height)
    }
    if (obj instanceof fabric.Ellipse) {
      if ('radiusX' in patch && patch.radiusX !== undefined) obj.set('rx', patch.radiusX)
      if ('radiusY' in patch && patch.radiusY !== undefined) obj.set('ry', patch.radiusY)
    }

    if (patch.lockAspectRatio !== undefined) {
      obj.set('lockUniScaling', patch.lockAspectRatio)
    }

    obj.setCoords()
    this.canvas?.requestRenderAll()
  }

  removeShape(id: string): void {
    if (this.disposed) return
    const obj = this.fabricMap.get(id)
    if (!obj) return

    // Remove from group if grouped
    const shape = this.shapeMap.get(id)
    if (shape?.groupId) {
      const group = this.groupMap.get(shape.groupId)
      if (group) {
        group.childIds = group.childIds.filter((cid) => cid !== id)
      }
      const renderer = this.rendererMap.get(shape.groupId)
      renderer?.fabricGroup.remove(obj)
    } else {
      this.canvas?.remove(obj)
    }

    this.shapeMap.delete(id)
    this.fabricMap.delete(id)
    this.canvas?.requestRenderAll()
    this.emitter.emit('shapeDeleted', { id })
  }

  getShape(id: string): LayoutShape | undefined {
    const data = this.shapeMap.get(id)
    if (!data) return undefined

    const obj = this.fabricMap.get(id)
    if (!obj) return { ...data }

    return fabricObjToLayoutShape(obj, data)
  }

  getAllShapes(): LayoutShape[] {
    return Array.from(this.shapeMap.keys()).map((id) => this.getShape(id)!)
  }

  // ─── Group Operations ──────────────────────────────────────────────────────

  createGroup(group: LayoutGroup): void {
    if (this.disposed || !this.canvas) return
    this.groupMap.set(group.id, { ...group })

    const renderer = new FabricGroupRenderer(group, this.canvas)
    this.rendererMap.set(group.id, renderer)

    // Tag for reverse lookup in event handlers
    ;(renderer.fabricGroup as unknown as Record<string, unknown>)[GROUP_DATA_KEY] = group.id

    // Move children into group — bypass group.add()/enterGroup to avoid
    // FitContentLayout corrupting the bin's fixed dimensions. Children that
    // already exist on the canvas (e.g. addShape was called before
    // createGroup) carry world coords on obj.left/top and must be converted
    // to group-local before reparenting; skipping the conversion would shift
    // them by the bin's centroid (issue #279). For the snapshot-restore
    // path, grouped children aren't in fabricMap yet, so this loop is a
    // no-op and addShape later attaches them at their already-local coords.
    for (const childId of group.childIds) {
      const obj = this.fabricMap.get(childId)
      if (obj) {
        const matrix = obj.calcTransformMatrix()
        const worldX = matrix[4]
        const worldY = matrix[5]
        this.canvas.remove(obj)
        const gMatrix = renderer.fabricGroup.calcTransformMatrix()
        const inv = fabric.util.invertTransform(gMatrix)
        const localPt = fabric.util.transformPoint(new fabric.Point(worldX, worldY), inv)
        obj.set({ left: localPt.x, top: localPt.y })
        obj.setCoords()
        renderer.attachChild(obj)
      }
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = group.id
    }

    this.canvas.add(renderer.fabricGroup)
    this.canvas.requestRenderAll()
    this.emitter.emit('groupChanged', { groupId: group.id, childIds: [...group.childIds] })
  }

  updateGroup(id: string, patch: Partial<LayoutGroup>): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return
    const renderer = this.rendererMap.get(id)
    if (!renderer) return

    // Lower-left is anchored across width/height changes, so the bin's
    // centroid moves by (deltaW/2, -deltaH/2). Children are rendered relative
    // to the centroid, so without compensation they drift by the same amount
    // — which is what `Sidebar.handleUpdateBinMetadata` was producing and
    // what the user-handle resize handler had to correct on its own.
    // Compensate here so every resize path preserves child world position.
    const deltaW = (patch.width ?? group.width) - group.width
    const deltaH = (patch.height ?? group.height) - group.height
    const dx = -deltaW / 2
    const dy = deltaH / 2

    Object.assign(group, patch, { id })

    if (dx !== 0 || dy !== 0) {
      const internalObjects = (
        renderer.fabricGroup as unknown as { _objects: fabric.FabricObject[] }
      )._objects
      for (const child of internalObjects) {
        const rec = child as unknown as Record<string, unknown>
        if (rec[SHAPE_DATA_KEY]) {
          child.set({ left: (child.left ?? 0) + dx, top: (child.top ?? 0) + dy })
          child.setCoords()
        }
      }
    }

    renderer.update(patch, group)
    this.emitter.emit('groupChanged', { groupId: id, childIds: [...group.childIds] })
  }

  removeGroup(id: string): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return

    const renderer = this.rendererMap.get(id)
    if (renderer && this.canvas) {
      // Ungroup: move child shapes back to canvas, skip internal bg rect and decorations
      const items = [...renderer.fabricGroup.getObjects()]
      for (const item of items) {
        const rec = item as unknown as Record<string, unknown>
        if (rec.__groupBg || rec.__binArtwork) continue
        const matrix = item.calcTransformMatrix()
        const point = new fabric.Point(matrix[4], matrix[5])
        renderer.fabricGroup.remove(item)
        item.set({ left: point.x, top: point.y })
        item.setCoords()
        this.canvas.add(item)
      }
      renderer.destroy()
    }

    // Update shape groupIds
    for (const childId of group.childIds) {
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = null
    }

    this.groupMap.delete(id)
    this.rendererMap.delete(id)
    this.canvas?.requestRenderAll()
    this.emitter.emit('groupChanged', { groupId: id, childIds: [] })
  }

  addToGroup(shapeId: string, groupId: string): void {
    if (this.disposed || !this.canvas) return
    const newGroup = this.groupMap.get(groupId)
    const newRenderer = this.rendererMap.get(groupId)
    const obj = this.fabricMap.get(shapeId)
    const shape = this.shapeMap.get(shapeId)

    if (!newGroup || !newRenderer || !obj || !shape) return
    if (shape.groupId === groupId) return

    // Compute world-space position before reparenting
    const matrix = obj.calcTransformMatrix()
    const worldX = matrix[4]
    const worldY = matrix[5]

    this.reassigningShape = true
    try {
      // If currently in another group, splice the obj out of that fabric.Group's
      // children and clear our childIds bookkeeping. Without this, reparenting
      // from group A to group B would leave the shape listed in both groups'
      // childIds (the visual moves, the bookkeeping doesn't).
      if (shape.groupId) {
        const oldGroup = this.groupMap.get(shape.groupId)
        const oldRenderer = this.rendererMap.get(shape.groupId)
        if (oldRenderer) {
          const internalObjects = (
            oldRenderer.fabricGroup as unknown as { _objects: fabric.FabricObject[] }
          )._objects
          const idx = internalObjects.indexOf(obj)
          if (idx !== -1) internalObjects.splice(idx, 1)
          obj._set('parent', undefined)
          obj._set('group', undefined)
          oldRenderer.fabricGroup.set('dirty', true)
        }
        if (oldGroup) {
          oldGroup.childIds = oldGroup.childIds.filter((id) => id !== shapeId)
        }
      } else {
        this.canvas.remove(obj)
      }

      // Convert world position to group-local coordinates (relative to centroid)
      const gMatrix = newRenderer.fabricGroup.calcTransformMatrix()
      const inv = fabric.util.invertTransform(gMatrix)
      const localPt = fabric.util.transformPoint(new fabric.Point(worldX, worldY), inv)
      obj.set({ left: localPt.x, top: localPt.y })
      obj.setCoords()

      newRenderer.attachChild(obj)

      newGroup.childIds = [...newGroup.childIds, shapeId]
      shape.groupId = groupId

      this.canvas.requestRenderAll()
    } finally {
      this.reassigningShape = false
    }
  }

  removeFromGroup(shapeId: string): void {
    if (this.disposed || !this.canvas) return
    const shape = this.shapeMap.get(shapeId)
    if (!shape?.groupId) return

    const group = this.groupMap.get(shape.groupId)
    const renderer = this.rendererMap.get(shape.groupId)
    const obj = this.fabricMap.get(shapeId)

    if (!group || !renderer || !obj) return

    // Calculate world position before removing from group
    const matrix = obj.calcTransformMatrix()
    const point = new fabric.Point(matrix[4], matrix[5])

    this.reassigningShape = true
    try {
      // Bypass group.remove() which triggers FitContentLayout recalculation.
      // Splice directly from _objects to preserve the bin's fixed dimensions.
      const internalObjects = (
        renderer.fabricGroup as unknown as { _objects: fabric.FabricObject[] }
      )._objects
      const idx = internalObjects.indexOf(obj)
      if (idx !== -1) internalObjects.splice(idx, 1)
      obj._set('parent', undefined)
      obj._set('group', undefined)

      obj.set({ left: point.x, top: point.y })
      obj.setCoords()
      this.canvas.add(obj)

      renderer.fabricGroup.set('dirty', true)

      group.childIds = group.childIds.filter((id) => id !== shapeId)
      shape.groupId = null

      this.canvas.requestRenderAll()
    } finally {
      this.reassigningShape = false
    }
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

  // ─── Selection ──────────────────────────────────────────────────────────────

  select(ids: string[]): void {
    if (this.disposed || !this.canvas) return
    this.canvas.discardActiveObject()

    const objects = ids
      .map((id) => this.fabricMap.get(id) ?? this.rendererMap.get(id)?.fabricGroup)
      .filter((o): o is fabric.FabricObject => o !== undefined)

    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0])
    } else if (objects.length > 1) {
      const sel = new fabric.ActiveSelection(objects, { canvas: this.canvas })
      this.canvas.setActiveObject(sel)
    }

    this.canvas.requestRenderAll()
    this.emitter.emit('selectionChanged', { ids: [...ids] })
  }

  selectIds(ids: string[]): void {
    this.select(ids)
  }

  addToSelection(ids: string[]): void {
    if (this.disposed || !this.canvas) return
    const current = this.getSelectedIds()
    const merged = [...new Set([...current, ...ids])]
    this.select(merged)
  }

  removeFromSelection(ids: string[]): void {
    if (this.disposed || !this.canvas) return
    const current = this.getSelectedIds()
    const remaining = current.filter((id) => !ids.includes(id))
    this.select(remaining)
  }

  clearSelection(): void {
    if (this.disposed || !this.canvas) return
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.emitter.emit('selectionChanged', { ids: [] })
  }

  getSelectedIds(): string[] {
    if (!this.canvas) return []
    const active = this.canvas.getActiveObject()
    if (!active) return []

    if (active instanceof fabric.ActiveSelection) {
      return active
        .getObjects()
        .map((o) => {
          const rec = o as unknown as Record<string, unknown>
          return (rec[SHAPE_DATA_KEY] as string) || (rec[GROUP_DATA_KEY] as string)
        })
        .filter(Boolean)
    }

    const rec = active as unknown as Record<string, unknown>
    const id = (rec[SHAPE_DATA_KEY] as string) || (rec[GROUP_DATA_KEY] as string)
    return id ? [id] : []
  }

  // ─── Viewport ───────────────────────────────────────────────────────────────

  panTo(x: number, y: number): void {
    if (this.disposed || !this.canvas) return
    const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    vpt[4] = -x
    vpt[5] = -y
    this.canvas.setViewportTransform(vpt)
    this.canvas.requestRenderAll()
    this.emitter.emit('viewportChanged', { panX: x, panY: y, zoom: vpt[0] })
  }

  zoomTo(level: number, center?: { x: number; y: number }): void {
    if (this.disposed || !this.canvas) return
    const clampedZoom = Math.max(0.1, Math.min(10, level))
    if (center) {
      this.canvas.zoomToPoint(new fabric.Point(center.x, center.y), clampedZoom)
    } else {
      const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
      vpt[0] = clampedZoom
      vpt[3] = clampedZoom
      this.canvas.setViewportTransform(vpt)
    }
    this.canvas.requestRenderAll()
    const vp = this.getViewport()
    this.emitter.emit('viewportChanged', vp)
  }

  resetView(): void {
    if (this.disposed || !this.canvas) return
    this.centerOrigin()
    this.canvas.requestRenderAll()
    const vp = this.getViewport()
    this.emitter.emit('viewportChanged', vp)
  }

  getViewport(): ViewportState {
    if (!this.canvas) return { panX: 0, panY: 0, zoom: 1 }
    const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    return { panX: -vpt[4] || 0, panY: -vpt[5] || 0, zoom: vpt[0] }
  }

  setViewportInsets(insets: ViewportInsets): void {
    const prev = this.insets
    if (prev.left === insets.left && prev.bottom === insets.bottom) return
    this.insets = insets
    // Re-center with new insets
    if (this.canvas && !this.disposed) {
      this.centerOrigin()
      this.canvas.requestRenderAll()
      const vp = this.getViewport()
      this.emitter.emit('viewportChanged', vp)
    }
  }

  // ─── Grid ───────────────────────────────────────────────────────────────────

  setGridConfig(config: Partial<GridConfig>): void {
    Object.assign(this.gridConfig, config)
    this.redrawGrid()
    this.canvas?.requestRenderAll()
  }

  getGridConfig(): GridConfig {
    return { ...this.gridConfig }
  }

  // ─── Theme ───────────────────────────────────────────────────────────────

  setThemeColors(colors: { background: string; grid: string; gridOrigin: string }): void {
    this.themeColors = colors
    if (this.canvas) {
      this.canvas.backgroundColor = colors.background
      this.redrawGrid()
      this.canvas.requestRenderAll()
    }
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

    // Clear everything
    for (const id of [...this.shapeMap.keys()]) {
      this.removeShape(id)
    }
    for (const id of [...this.groupMap.keys()]) {
      this.removeGroup(id)
    }

    // Restore grid
    this.setGridConfig(snapshot.gridConfig)

    // Add shapes (ungrouped first)
    const ungrouped = snapshot.shapes.filter((s) => !s.groupId)
    const grouped = snapshot.shapes.filter((s) => s.groupId)

    for (const shape of ungrouped) {
      this.addShape(shape)
    }

    // Create groups
    for (const group of snapshot.groups) {
      this.createGroup(group)
    }

    // Add grouped shapes
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
    // Don't restore selection — it doesn't survive engine switches cleanly
  }

  // ─── Capabilities ───────────────────────────────────────────────────────────

  capabilities(): Set<string> {
    return new Set(['rect', 'circle', 'polygon', 'svgPath', 'meshImport', 'group', 'selection'])
  }

  // ─── Interaction State ──────────────────────────────────────────────────────

  isInteracting(): boolean {
    return this.interacting
  }

  // Fabric handles click-to-select natively on pointerdown.
  // GestureRecognizer must not duplicate this on pointerup.
  readonly handlesNativeClickSelect = true

  // ─── Input Action Handler ─────────────────────────────────────────────────

  applyPan(dx: number, dy: number): void {
    if (this.disposed || !this.canvas) return
    const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    vpt[4] += dx
    vpt[5] += dy
    this.canvas.setViewportTransform(vpt)
    this.canvas.requestRenderAll()
    this.emitter.emit('viewportChanged', this.getViewport())
  }

  applyZoom(delta: number, centerX: number, centerY: number): void {
    if (this.disposed || !this.canvas) return
    let zoom = this.canvas.getZoom()
    zoom *= 0.999 ** delta
    zoom = Math.min(Math.max(zoom, 0.1), 10)
    this.canvas.zoomToPoint(new fabric.Point(centerX, centerY), zoom)
    this.canvas.requestRenderAll()
    this.emitter.emit('viewportChanged', this.getViewport())
  }

  setDragEnabled(enabled: boolean): void {
    if (this.disposed || !this.canvas) return
    // Toggle canvas.selection to suppress Fabric's native rubber-band during
    // GestureRecognizer-owned gestures (pan, rubber-band).
    this.canvas.selection = enabled
  }

  objectAt(worldX: number, worldY: number): HitResult | null {
    if (!this.canvas) return null
    const point = new fabric.Point(worldX, worldY)
    const objects = this.canvas.getObjects()
    // Iterate in reverse for topmost-first hit order
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i]
      if (!obj.evented) continue
      if (obj.containsPoint(point)) {
        const rec = obj as unknown as Record<string, unknown>
        const groupId = rec[GROUP_DATA_KEY] as string | undefined
        if (groupId) return { type: 'group', id: groupId }
        const shapeId = rec[SHAPE_DATA_KEY] as string | undefined
        if (shapeId) return { type: 'shape', id: shapeId }
      }
    }
    return null
  }

  objectsInRect(rect: { x: number; y: number; width: number; height: number }): HitResult[] {
    if (!this.canvas) return []
    const hits: HitResult[] = []

    for (const obj of this.canvas.getObjects()) {
      const rec = obj as unknown as Record<string, unknown>
      const groupId = rec[GROUP_DATA_KEY] as string | undefined
      const shapeId = rec[SHAPE_DATA_KEY] as string | undefined
      if (!groupId && !shapeId) continue

      const coords = obj.aCoords
      if (!coords) continue
      const xs = [coords.tl.x, coords.tr.x, coords.bl.x, coords.br.x]
      const ys = [coords.tl.y, coords.tr.y, coords.bl.y, coords.br.y]
      const objMinX = Math.min(...xs)
      const objMaxX = Math.max(...xs)
      const objMinY = Math.min(...ys)
      const objMaxY = Math.max(...ys)

      // AABB overlap test
      if (
        objMinX < rect.x + rect.width &&
        objMaxX > rect.x &&
        objMinY < rect.y + rect.height &&
        objMaxY > rect.y
      ) {
        if (groupId) {
          hits.push({ type: 'group', id: groupId })
        } else if (shapeId) {
          hits.push({ type: 'shape', id: shapeId })
        }
      }
    }

    return hits
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.canvas) return { x: screenX, y: screenY }
    const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const zoom = vpt[0]
    return {
      x: (screenX - vpt[4]) / zoom,
      y: (screenY - vpt[5]) / zoom
    }
  }

  private rubberBandRect: fabric.Rect | null = null

  showRubberBand(rect: { x: number; y: number; width: number; height: number }): void {
    if (!this.canvas) return
    if (!this.rubberBandRect) {
      this.rubberBandRect = new fabric.Rect({
        fill: 'rgba(100, 150, 255, 0.1)',
        stroke: 'rgba(100, 150, 255, 0.6)',
        strokeWidth: 1,
        strokeUniform: true,
        strokeDashArray: [4, 4],
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        excludeFromExport: true
      })
      this.canvas.add(this.rubberBandRect)
    }
    this.rubberBandRect.set({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height
    })
    this.rubberBandRect.setCoords()
    this.canvas.requestRenderAll()
  }

  hideRubberBand(): void {
    if (!this.canvas || !this.rubberBandRect) return
    this.canvas.remove(this.rubberBandRect)
    this.rubberBandRect = null
    this.canvas.requestRenderAll()
  }

  // ─── Private: Viewport centering ────────────────────────────────────────────

  /**
   * Position the world origin near the bottom-left of the unoccluded canvas
   * area with 1.5 grid-unit padding. Zoom is derived from grid size alone
   * (not viewport dimensions) so resizing the window changes how many cells
   * are visible, not how large they appear.
   */
  private centerOrigin(): void {
    if (!this.canvas) return
    const h = this.canvas.getHeight()
    const l = this.insets.left ?? 0
    const b = this.insets.bottom ?? 0
    const gs = this.gridConfig.size
    // Target: each grid cell ≈ 64 screen pixels at default zoom
    const zoom = 64 / gs
    const pad = 1.5 * gs * zoom
    const ox = l + pad
    const oy = h - b - pad
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, ox, oy])
  }

  // ─── Private: Grid ──────────────────────────────────────────────────────────

  private drawGrid(): void {
    if (!this.canvas || !this.gridConfig.visible) return

    const size = this.gridConfig.size
    const sub = size / 4
    const { grid, gridOrigin } = this.themeColors
    const startMajor = Math.ceil(-GRID_EXTENT / size) * size
    const startSub = Math.ceil(-GRID_EXTENT / sub) * sub

    const addLine = (
      coords: [number, number, number, number],
      stroke: string,
      strokeWidth: number
    ): void => {
      const line = new fabric.Line(coords, {
        stroke,
        strokeWidth,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        opacity: strokeWidth < 0.5 ? 0.4 : 1
      })
      this.gridLines.push(line)
      this.canvas!.add(line)
      this.canvas!.sendObjectToBack(line)
    }

    // Subdivision lines — start from aligned position
    for (let x = startSub; x <= GRID_EXTENT; x += sub) {
      if (Math.abs(x % size) < 0.001) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.25)
    }
    for (let y = startSub; y <= GRID_EXTENT; y += sub) {
      if (Math.abs(y % size) < 0.001) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.25)
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
  }

  private redrawGrid(): void {
    if (!this.canvas) return
    for (const line of this.gridLines) {
      this.canvas.remove(line)
    }
    this.gridLines = []
    this.drawGrid()
  }

  // ─── Private: Event handlers ────────────────────────────────────────────────

  /** Disable scaling/rotation on Fabric's ActiveSelection (multi-select frame) */
  private lockActiveSelection(): void {
    if (!this.canvas) return
    const active = this.canvas.getActiveObject()
    if (!active || !(active instanceof fabric.ActiveSelection)) return

    // Lock the multi-select frame — it shouldn't scale/rotate individual objects
    active.set({
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false
    })
  }

  private setupEventHandlers(): void {
    if (!this.canvas) return

    this.canvas.on('selection:created', () => {
      if (this.disposed) return
      this.lockActiveSelection()
      this.emitter.emit('selectionChanged', { ids: this.getSelectedIds() })
    })

    this.canvas.on('selection:updated', () => {
      if (this.disposed) return
      this.lockActiveSelection()
      this.emitter.emit('selectionChanged', { ids: this.getSelectedIds() })
    })

    this.canvas.on('selection:cleared', () => {
      if (this.disposed) return
      this.emitter.emit('selectionChanged', { ids: [] })
    })

    // Rects and ellipses: reset scale and update real dimensions so they stay crisp
    // and corner radii remain constant. Polygons/paths are natively vector — let them keep scale.
    // Groups (bins): let Fabric handle scale freely during drag; snap on release in object:modified.
    this.canvas.on('object:scaling', (e) => {
      if (this.disposed) return
      const obj = e.target
      if (!obj) return

      // Skip groups — their resize is finalized in object:modified to avoid
      // fighting between live scale snap and Fabric's position anchoring.
      // Show a non-scaling overlay as ghost preview while scaling.
      const groupId = (obj as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (groupId) {
        this.updateResizeOverlay(groupId, obj)
        return
      }

      if (obj instanceof fabric.Polygon || obj instanceof fabric.Path) return

      const scaleX = obj.scaleX ?? 1
      const scaleY = obj.scaleY ?? 1

      if (obj instanceof fabric.Ellipse) {
        obj.set({ rx: obj.rx * scaleX, ry: obj.ry * scaleY, scaleX: 1, scaleY: 1 })
      } else {
        obj.set({
          width: (obj.width ?? 0) * scaleX,
          height: (obj.height ?? 0) * scaleY,
          scaleX: 1,
          scaleY: 1
        })
      }
      obj.setCoords()
    })

    // Capture pre-drag/resize state for edge-anchoring and live collision
    this.canvas.on('mouse:down', (opt) => {
      const obj = opt.target
      if (obj) this.interacting = true
      if (!obj) return

      // ActiveSelection: capture pre-drag state for all group children
      if (obj instanceof fabric.ActiveSelection) {
        this.lastGoodPos.set('__activeSelection', { left: obj.left ?? 0, top: obj.top ?? 0 })
        for (const child of obj.getObjects()) {
          const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
          if (!gid) continue
          const group = this.groupMap.get(gid)
          const renderer = this.rendererMap.get(gid)
          if (group && renderer) {
            const pos = renderer.readPosition()
            this.preDragState.set(gid, {
              left: child.left ?? 0,
              top: child.top ?? 0,
              lowerLeftX: pos.x,
              lowerLeftY: pos.y,
              width: group.width,
              height: group.height
            })
          }
        }
        return
      }

      const groupId = (obj as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (groupId) {
        const group = this.groupMap.get(groupId)
        const renderer = this.rendererMap.get(groupId)
        if (group && renderer) {
          const pos = renderer.readPosition()
          this.preDragState.set(groupId, {
            left: obj.left ?? 0,
            top: obj.top ?? 0,
            lowerLeftX: pos.x,
            lowerLeftY: pos.y,
            width: group.width,
            height: group.height
          })
          this.lastGoodPos.set(groupId, { left: obj.left ?? 0, top: obj.top ?? 0 })
        }
      }
    })

    this.canvas.on('object:modified', (e) => {
      if (this.disposed) return
      const obj = e.target
      if (!obj) return

      // Multi-select: commit all groups and shapes in the ActiveSelection
      if (obj instanceof fabric.ActiveSelection) {
        this.handleActiveSelectionModified(obj)
        return
      }

      const shapeId = (obj as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string
      if (shapeId && !this.reassigningShape) {
        // Evaluate reassignment first so any reparenting happens before we
        // snapshot the new position. Otherwise the undo entry pushed by
        // shapeMoved captures a state with the old groupId at the new
        // position, and Cmd+Z lands the user in that intermediate state.
        this.evaluateShapeReassignment(shapeId, obj)

        this.emitter.emit('shapeMoved', { id: shapeId, x: obj.left ?? 0, y: obj.top ?? 0 })

        // Emit shapeResized with current dimensions
        const data = this.shapeMap.get(shapeId)
        if (data) {
          const shape = fabricObjToLayoutShape(obj, data)
          const resizePayload: EngineEventMap['shapeResized'] = { id: shapeId }
          if ('width' in shape) resizePayload.width = shape.width
          if ('height' in shape) resizePayload.height = shape.height
          if ('radiusX' in shape) resizePayload.radiusX = shape.radiusX
          if ('radiusY' in shape) resizePayload.radiusY = shape.radiusY
          this.emitter.emit('shapeResized', resizePayload)
        }
      }

      const groupId = (obj as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (groupId) {
        this.handleGroupModified(groupId, obj)
      }
    })

    this.canvas.on('mouse:up', () => {
      this.interacting = false
    })
  }

  // ─── Private: Group move/resize with collision ─────────────────────────────

  private handleGroupModified(groupId: string, obj: fabric.FabricObject): void {
    const renderer = this.rendererMap.get(groupId)
    const group = this.groupMap.get(groupId)
    if (!renderer || !group) return

    // Remove resize overlay (if resize was in progress)
    this.removeResizeOverlay()

    const gs = this.gridConfig.size
    const saved = this.preDragState.get(groupId)
    const scaleX = obj.scaleX ?? 1
    const scaleY = obj.scaleY ?? 1
    const wasResized = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001

    if (wasResized && saved) {
      // Reset scale to 1 — we commit actual dimensions
      obj.set({ scaleX: 1, scaleY: 1 })

      // Edge-anchor + grid quantization using shared math
      const centroidX = obj.left ?? 0
      const centroidY = obj.top ?? 0
      const originalBounds = {
        x: saved.lowerLeftX,
        y: saved.lowerLeftY,
        width: saved.width,
        height: saved.height
      }
      const anchored = computeEdgeAnchor(
        originalBounds,
        scaleX,
        scaleY,
        centroidX,
        centroidY,
        this.gridConfig.enabled ? gs : 1
      )
      const finalX = anchored.x
      const finalY = anchored.y
      const newW = anchored.width
      const newH = anchored.height

      // Collision check
      const proposed = { x: finalX, y: finalY, width: newW, height: newH }
      const collider = checkGroupCollision(proposed, groupId, this.getAllGroups())
      if (collider) {
        // Revert to pre-resize state — no flash since this is expected prevention
        obj.set({ left: saved.left, top: saved.top, scaleX: 1, scaleY: 1 })
        obj.setCoords()
        this.canvas?.requestRenderAll()
        this.preDragState.delete(groupId)
        this.lastGoodPos.delete(groupId)
        this.emitter.emit('collisionRejected', { id: groupId, reason: 'resize' })
        return
      }

      // Commit the resize
      group.x = finalX
      group.y = finalY
      group.width = newW
      group.height = newH

      // Update bin metadata units
      const meta = group.metadata as Record<string, unknown> | undefined
      if (meta && typeof meta.widthUnits === 'number') {
        meta.widthUnits = Math.round(newW / gs)
        meta.depthUnits = Math.round(newH / gs)
      }

      // Translate user-shape children so their world positions stay constant.
      // The bin's centroid moves when the lower-left is preserved across a
      // resize, so each child's local position (relative to centroid) needs
      // to shift by the centroid delta to keep the child visually anchored.
      const preCentroidX = saved.lowerLeftX + saved.width / 2
      const preCentroidY = saved.lowerLeftY - saved.height / 2
      const postCentroidX = finalX + newW / 2
      const postCentroidY = finalY - newH / 2
      const dx = preCentroidX - postCentroidX
      const dy = preCentroidY - postCentroidY
      const internalObjects = (
        renderer.fabricGroup as unknown as { _objects: fabric.FabricObject[] }
      )._objects
      for (const child of internalObjects) {
        const rec = child as unknown as Record<string, unknown>
        if (rec[SHAPE_DATA_KEY]) {
          child.set({ left: (child.left ?? 0) + dx, top: (child.top ?? 0) + dy })
          child.setCoords()
        }
      }

      renderer.update({ x: finalX, y: finalY, width: newW, height: newH }, group)
      this.preDragState.delete(groupId)
      this.lastGoodPos.delete(groupId)
      this.emitter.emit('groupResized', { id: groupId, width: newW, height: newH })
      this.emitter.emit('groupChanged', { groupId, childIds: [...group.childIds] })
    } else {
      // Move only — live prevention should have handled collision during drag.
      // Safety check: flash red if bins are truly overlapping (edge case).
      const pos = renderer.readPosition()

      const proposed = { x: pos.x, y: pos.y, width: group.width, height: group.height }
      const collider = checkGroupCollision(proposed, groupId, this.getAllGroups())
      if (collider) {
        if (saved) {
          obj.set({ left: saved.left, top: saved.top })
          obj.setCoords()
          this.canvas?.requestRenderAll()
        }
        this.preDragState.delete(groupId)
        this.lastGoodPos.delete(groupId)
        this.flashCollision(renderer)
        this.emitter.emit('collisionRejected', { id: groupId, reason: 'move' })
        return
      }

      group.x = pos.x
      group.y = pos.y
      this.preDragState.delete(groupId)
      this.lastGoodPos.delete(groupId)
      this.emitter.emit('groupMoved', { id: groupId, x: group.x, y: group.y })
    }
  }

  /**
   * Handle object:modified for an ActiveSelection (multi-select drag).
   * Commits all group positions and shape positions atomically.
   * Live collision prevention in object:moving should have already blocked
   * overlapping moves, but we do a safety check and revert if needed.
   */
  private handleActiveSelectionModified(sel: fabric.ActiveSelection): void {
    const children = sel.getObjects()

    // Collect selected group IDs for collision exclusion
    const selectedGroupIds = new Set<string>()
    for (const child of children) {
      const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (gid) selectedGroupIds.add(gid)
    }

    // Safety collision check — should rarely trigger since object:moving prevents it
    let hasCollision = false
    for (const child of children) {
      const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (!gid) continue
      const group = this.groupMap.get(gid)
      const renderer = this.rendererMap.get(gid)
      if (!group || !renderer) continue

      const pos = renderer.readPosition()
      const proposed = { x: pos.x, y: pos.y, width: group.width, height: group.height }
      if (checkGroupCollision(proposed, gid, this.getAllGroups(), selectedGroupIds)) {
        hasCollision = true
        break
      }
    }

    if (hasCollision) {
      // Revert the entire selection to pre-drag position
      const savedSelPos = this.lastGoodPos.get('__activeSelection')
      if (savedSelPos) {
        sel.set({ left: savedSelPos.left, top: savedSelPos.top })
        sel.setCoords()
        this.canvas?.requestRenderAll()
      }
      // Flash collision on all group renderers
      for (const gid of selectedGroupIds) {
        const renderer = this.rendererMap.get(gid)
        if (renderer) this.flashCollision(renderer)
      }
      // Clean up
      for (const gid of selectedGroupIds) {
        this.preDragState.delete(gid)
      }
      this.lastGoodPos.delete('__activeSelection')
      return
    }

    // No collision — commit all positions
    for (const child of children) {
      const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (gid) {
        const group = this.groupMap.get(gid)
        const renderer = this.rendererMap.get(gid)
        if (group && renderer) {
          const pos = renderer.readPosition()
          group.x = pos.x
          group.y = pos.y
          this.emitter.emit('groupMoved', { id: gid, x: pos.x, y: pos.y })
        }
        this.preDragState.delete(gid)
        continue
      }

      const shapeId = (child as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string
      if (shapeId) {
        // World position for shapes inside ActiveSelection
        const matrix = child.calcTransformMatrix()
        const worldX = matrix[4]
        const worldY = matrix[5]
        const data = this.shapeMap.get(shapeId)
        if (data) {
          data.x = worldX
          data.y = worldY
        }
        this.emitter.emit('shapeMoved', { id: shapeId, x: worldX, y: worldY })
      }
    }

    this.lastGoodPos.delete('__activeSelection')
  }

  /**
   * Evaluate whether a shape should be reassigned to a different bin (or unassigned)
   * based on its world-space centroid after a drag ends.
   */
  private evaluateShapeReassignment(shapeId: string, obj: fabric.FabricObject): void {
    // Clear any drag highlight
    if (this.highlightedGroupId) {
      this.rendererMap.get(this.highlightedGroupId)?.unhighlight()
      this.highlightedGroupId = null
    }

    const data = this.shapeMap.get(shapeId)
    if (!data) return

    // Compute world-space centroid of the shape
    const matrix = obj.calcTransformMatrix()
    const worldX = matrix[4]
    const worldY = matrix[5]

    // Find which bin contains the shape's centroid
    const targetBin = findContainingBinGroup(this.getAllGroups(), worldX, worldY)
    const targetGroupId = targetBin?.id ?? null
    const currentGroupId = data.groupId

    // No change needed
    if (targetGroupId === currentGroupId) return

    // Remove from old group
    if (currentGroupId) {
      this.removeFromGroup(shapeId)
    }

    // Add to new group
    if (targetGroupId) {
      this.addToGroup(shapeId, targetGroupId)
    }

    // Emit reassignment event and tick
    this.emitter.emit('shapeReassigned', {
      shapeId,
      oldGroupId: currentGroupId,
      newGroupId: targetGroupId
    })
  }

  /** Create or update a non-scaling overlay rect showing grid-snapped resize preview. */
  private updateResizeOverlay(groupId: string, obj: fabric.FabricObject): void {
    if (!this.canvas) return
    const renderer = this.rendererMap.get(groupId)
    const group = this.groupMap.get(groupId)
    const saved = this.preDragState.get(groupId)
    if (!renderer || !group || !saved) return

    const sx = obj.scaleX ?? 1
    const sy = obj.scaleY ?? 1
    const cx = obj.left ?? 0
    const cy = obj.top ?? 0
    const gs = this.gridConfig.size

    // Edge-anchor + grid quantization using shared math
    const originalBounds = {
      x: saved.lowerLeftX,
      y: saved.lowerLeftY,
      width: saved.width,
      height: saved.height
    }
    const overlayAnchored = computeEdgeAnchor(
      originalBounds,
      sx,
      sy,
      cx,
      cy,
      this.gridConfig.enabled ? gs : 1
    )
    const snapW = overlayAnchored.width
    const snapH = overlayAnchored.height
    const overlayLeft = overlayAnchored.x
    const overlayTop = overlayAnchored.y - overlayAnchored.height // lower-left y → top-left y

    // Overlay uses center origin — convert from top-left
    const overlayCX = overlayLeft + snapW / 2
    const overlayCY = overlayTop + snapH / 2

    // Check if snapped dimensions would collide
    const proposed = { x: overlayAnchored.x, y: overlayAnchored.y, width: snapW, height: snapH }
    const wouldCollide = checkGroupCollision(proposed, groupId, this.getAllGroups())

    if (!this.resizeOverlay) {
      // Read style from bgRect
      const bgObj = renderer.fabricGroup
        .getObjects()
        .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
      const stroke = (bgObj?.get('stroke') as string) ?? '#666666'
      const strokeWidth = (bgObj?.get('strokeWidth') as number) ?? 1
      const cornerRadius = (bgObj?.get('rx') as number) ?? 0

      // First frame — create overlay and hide the actual group
      this.resizeOverlay = new fabric.Rect({
        left: overlayCX,
        top: overlayCY,
        width: snapW,
        height: snapH,
        fill: wouldCollide ? 'rgba(239, 68, 68, 0.08)' : 'rgba(113, 113, 122, 0.08)',
        stroke: wouldCollide ? '#ef4444' : stroke,
        strokeWidth,
        strokeUniform: true,
        strokeDashArray: [6, 3],
        rx: cornerRadius,
        ry: cornerRadius,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        excludeFromExport: true
      })
      ;(this.resizeOverlay as unknown as Record<string, unknown>).__origStroke = stroke
      this.resizeOverlayGroupId = groupId
      this.canvas.add(this.resizeOverlay)
      renderer.fabricGroup.set('opacity', 0)
    } else {
      // Subsequent frames — update position, size, and collision indicator
      const origStroke = (this.resizeOverlay as unknown as Record<string, unknown>)
        .__origStroke as string
      this.resizeOverlay.set({
        left: overlayCX,
        top: overlayCY,
        width: snapW,
        height: snapH,
        stroke: wouldCollide ? '#ef4444' : origStroke,
        fill: wouldCollide ? 'rgba(239, 68, 68, 0.08)' : 'rgba(113, 113, 122, 0.08)'
      })
      this.resizeOverlay.setCoords()
    }
    this.canvas.requestRenderAll()
  }

  /** Remove overlay and restore group visibility. */
  private removeResizeOverlay(): void {
    if (this.resizeOverlay && this.canvas) {
      this.canvas.remove(this.resizeOverlay)
      this.resizeOverlay = null
    }
    if (this.resizeOverlayGroupId) {
      const renderer = this.rendererMap.get(this.resizeOverlayGroupId)
      if (renderer) {
        renderer.fabricGroup.set('opacity', 1)
      }
      this.resizeOverlayGroupId = null
    }
    this.canvas?.requestRenderAll()
  }

  /** Brief red flash on the group border to indicate a collision rejection. */
  private flashCollision(renderer: FabricGroupRenderer): void {
    const bgRect = renderer.fabricGroup
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
    if (!bgRect) return
    const origStroke = bgRect.get('stroke') as string
    const origStrokeWidth = bgRect.get('strokeWidth') as number
    bgRect.set({ stroke: '#ef4444', strokeWidth: 2 })
    this.canvas?.requestRenderAll()
    setTimeout(() => {
      bgRect.set({ stroke: origStroke, strokeWidth: origStrokeWidth })
      this.canvas?.requestRenderAll()
    }, 300)
  }

  // ─── Private: Snap to grid ──────────────────────────────────────────────────

  private setupSnapToGrid(): void {
    if (!this.canvas) return
    this.canvas.on('object:moving', (e) => {
      const obj = e.target
      if (!obj) return
      const gridEnabled = this.gridConfig.enabled
      const size = this.gridConfig.size

      // Multi-select (ActiveSelection): snap based on first group's lower-left corner,
      // then collision-check all groups against non-selected groups.
      if (obj instanceof fabric.ActiveSelection) {
        const children = obj.getObjects()

        if (gridEnabled) {
          const firstGroupObj = children.find(
            (o) => (o as unknown as Record<string, unknown>)[GROUP_DATA_KEY]
          )
          if (firstGroupObj) {
            const gid = (firstGroupObj as unknown as Record<string, unknown>)[
              GROUP_DATA_KEY
            ] as string
            const group = this.groupMap.get(gid)
            if (group) {
              // Child left/top is relative to ActiveSelection center.
              // World centroid = selectionCenter + childOffset
              const worldCentroidX = (obj.left ?? 0) + (firstGroupObj.left ?? 0)
              const worldCentroidY = (obj.top ?? 0) + (firstGroupObj.top ?? 0)
              const lowerLeftX = worldCentroidX - group.width / 2
              const lowerLeftY = worldCentroidY + group.height / 2
              const dx = Math.round(lowerLeftX / size) * size - lowerLeftX
              const dy = Math.round(lowerLeftY / size) * size - lowerLeftY
              obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
            }
          } else {
            // No groups — snap frame center
            obj.set({
              left: Math.round((obj.left ?? 0) / size) * size,
              top: Math.round((obj.top ?? 0) / size) * size
            })
          }
        }

        // Live collision prevention for multi-select:
        // Check each group in the selection against non-selected groups.
        const selectedGroupIds = new Set<string>()
        for (const child of children) {
          const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
          if (gid) selectedGroupIds.add(gid)
        }

        let hasCollision = false
        for (const child of children) {
          const gid = (child as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
          if (!gid) continue
          const group = this.groupMap.get(gid)
          if (!group) continue

          // World centroid = selection center + child offset
          const worldCX = (obj.left ?? 0) + (child.left ?? 0)
          const worldCY = (obj.top ?? 0) + (child.top ?? 0)
          const lowerLeftX = worldCX - group.width / 2
          const lowerLeftY = worldCY + group.height / 2

          const proposed = {
            x: lowerLeftX,
            y: lowerLeftY,
            width: group.width,
            height: group.height
          }
          if (checkGroupCollision(proposed, gid, this.getAllGroups(), selectedGroupIds)) {
            hasCollision = true
            break
          }
        }

        const lastGood = this.lastGoodPos.get('__activeSelection')
        if (hasCollision && lastGood) {
          obj.set({ left: lastGood.left, top: lastGood.top })
        } else {
          this.lastGoodPos.set('__activeSelection', { left: obj.left ?? 0, top: obj.top ?? 0 })
        }

        obj.setCoords()
        return
      }

      const groupId = (obj as unknown as Record<string, unknown>)[GROUP_DATA_KEY] as string
      if (groupId) {
        // Skip snap + collision if the group is being resized (scale != 1).
        // Fabric fires object:moving during resize to anchor the opposite edge;
        // snapping the position mid-resize causes the group to slide.
        const sx = obj.scaleX ?? 1
        const sy = obj.scaleY ?? 1
        if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) return

        const renderer = this.rendererMap.get(groupId)
        if (renderer) {
          if (gridEnabled) {
            renderer.snapToGrid(size)
          }

          // Live collision prevention — revert to last good position if overlapping
          const group = this.groupMap.get(groupId)
          if (group) {
            const pos = renderer.readPosition()
            const proposed = { x: pos.x, y: pos.y, width: group.width, height: group.height }
            const collider = checkGroupCollision(proposed, groupId, this.getAllGroups())
            const lastGood = this.lastGoodPos.get(groupId)
            if (collider && lastGood) {
              obj.set({ left: lastGood.left, top: lastGood.top })
              obj.setCoords()
            } else {
              this.lastGoodPos.set(groupId, { left: obj.left ?? 0, top: obj.top ?? 0 })
            }
          }
        }
      }
      // Shapes do not snap to the bin grid — they move freely.
      obj.setCoords()

      // Highlight the target bin during shape drag (drop-target feedback)
      const shapeId = (obj as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string
      if (shapeId) {
        const matrix = obj.calcTransformMatrix()
        const worldX = matrix[4]
        const worldY = matrix[5]
        const targetBin = findContainingBinGroup(this.getAllGroups(), worldX, worldY)
        const targetId = targetBin?.id ?? null
        if (targetId !== this.highlightedGroupId) {
          // Unhighlight previous
          if (this.highlightedGroupId) {
            this.rendererMap.get(this.highlightedGroupId)?.unhighlight()
          }
          // Highlight new
          if (targetId) {
            this.rendererMap.get(targetId)?.highlight()
          }
          this.highlightedGroupId = targetId
        }
      }
    })
  }

  // ─── Private: Pan & Zoom ────────────────────────────────────────────────────
  // TODO(#226): Extract pan/zoom/drag into a shared input manager

  // setupPanZoom removed — pan/zoom now handled by GestureRecognizer (#226)
}

// Auto-register
registerEngine('fabric', FabricEngine)
