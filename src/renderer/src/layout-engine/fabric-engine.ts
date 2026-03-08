import * as fabric from 'fabric'
import mitt from 'mitt'
import type { LayoutEngine } from './interface'
import type {
  LayoutShape,
  LayoutGroup,
  LayoutSnapshot,
  GridConfig,
  ViewportState,
  TransientState,
  EngineEventMap
} from './types'
import { registerEngine } from './create-engine'

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
  private fabricGroupMap = new Map<string, fabric.Group>()
  private gridLines: fabric.FabricObject[] = []
  private gridConfig: GridConfig = { size: 42, enabled: true, visible: true }
  private themeColors = {
    background: DEFAULT_BG,
    grid: DEFAULT_GRID_COLOR,
    gridOrigin: DEFAULT_GRID_ORIGIN
  }

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
    this.setupPanZoom()
    this.setupSnapToGrid()

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
    this.fabricGroupMap.clear()
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

    if (shape.groupId && this.fabricGroupMap.has(shape.groupId)) {
      const group = this.fabricGroupMap.get(shape.groupId)!
      group.add(obj)
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
      const fabricGroup = this.fabricGroupMap.get(shape.groupId)
      fabricGroup?.remove(obj)
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
    if (this.disposed) return
    this.groupMap.set(group.id, { ...group })

    // Background rect for the group (makes it visible even when empty)
    const bgRect = new fabric.Rect({
      left: -group.width / 2,
      top: -group.height / 2,
      width: group.width,
      height: group.height,
      fill: group.style.fill,
      stroke: group.style.stroke,
      strokeWidth: group.style.strokeWidth,
      rx: group.style.cornerRadius ?? 0,
      ry: group.style.cornerRadius ?? 0,
      selectable: false,
      evented: false
    })
    ;(bgRect as unknown as Record<string, unknown>).__groupBg = true

    // Collect fabric objects for children
    const children: fabric.FabricObject[] = [bgRect]
    for (const childId of group.childIds) {
      const obj = this.fabricMap.get(childId)
      if (obj) {
        this.canvas?.remove(obj)
        children.push(obj)
      }
      // Update child's groupId
      const shape = this.shapeMap.get(childId)
      if (shape) {
        shape.groupId = group.id
      }
    }

    const fabricGroup = new fabric.Group(children, {
      left: group.x,
      top: group.y,
      width: group.width,
      height: group.height,
      subTargetCheck: true,
      interactive: true
    })
    ;(fabricGroup as unknown as Record<string, unknown>)[GROUP_DATA_KEY] = group.id

    this.fabricGroupMap.set(group.id, fabricGroup)
    this.canvas?.add(fabricGroup)
    this.canvas?.requestRenderAll()
  }

  updateGroup(id: string, patch: Partial<LayoutGroup>): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return

    Object.assign(group, patch, { id })

    const fabricGroup = this.fabricGroupMap.get(id)
    if (!fabricGroup) return

    if (patch.x !== undefined) fabricGroup.set('left', patch.x)
    if (patch.y !== undefined) fabricGroup.set('top', patch.y)
    if (patch.rotation !== undefined) fabricGroup.set('angle', patch.rotation)

    // Update background rect if width/height/style changed
    if (patch.width !== undefined || patch.height !== undefined || patch.style !== undefined) {
      const bgRect = fabricGroup
        .getObjects()
        .find((o) => (o as unknown as Record<string, unknown>).__groupBg)
      if (bgRect) {
        if (patch.width !== undefined) {
          bgRect.set('width', group.width)
          bgRect.set('left', -group.width / 2)
          fabricGroup.set('width', group.width)
        }
        if (patch.height !== undefined) {
          bgRect.set('height', group.height)
          bgRect.set('top', -group.height / 2)
          fabricGroup.set('height', group.height)
        }
        if (patch.style) {
          bgRect.set('fill', group.style.fill)
          bgRect.set('stroke', group.style.stroke)
          bgRect.set('strokeWidth', group.style.strokeWidth)
          bgRect.set('rx', group.style.cornerRadius ?? 0)
          bgRect.set('ry', group.style.cornerRadius ?? 0)
        }
      }
    }

    fabricGroup.setCoords()
    this.canvas?.requestRenderAll()
  }

  removeGroup(id: string): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return

    const fabricGroup = this.fabricGroupMap.get(id)
    if (fabricGroup && this.canvas) {
      // Ungroup: move children back to canvas at world-space positions
      const items = [...fabricGroup.getObjects()]
      for (const item of items) {
        const matrix = item.calcTransformMatrix()
        const point = new fabric.Point(matrix[4], matrix[5])
        fabricGroup.remove(item)
        item.set({ left: point.x, top: point.y })
        item.setCoords()
        this.canvas.add(item)
      }
      this.canvas.remove(fabricGroup)
    }

    // Update shape groupIds
    for (const childId of group.childIds) {
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = null
    }

    this.groupMap.delete(id)
    this.fabricGroupMap.delete(id)
    this.canvas?.requestRenderAll()
  }

  addToGroup(shapeId: string, groupId: string): void {
    if (this.disposed) return
    const group = this.groupMap.get(groupId)
    const fabricGroup = this.fabricGroupMap.get(groupId)
    const obj = this.fabricMap.get(shapeId)
    const shape = this.shapeMap.get(shapeId)

    if (!group || !fabricGroup || !obj || !shape) return

    this.canvas?.remove(obj)
    fabricGroup.add(obj)

    group.childIds = [...group.childIds, shapeId]
    shape.groupId = groupId

    this.canvas?.requestRenderAll()
  }

  removeFromGroup(shapeId: string): void {
    if (this.disposed) return
    const shape = this.shapeMap.get(shapeId)
    if (!shape?.groupId) return

    const group = this.groupMap.get(shape.groupId)
    const fabricGroup = this.fabricGroupMap.get(shape.groupId)
    const obj = this.fabricMap.get(shapeId)

    if (!group || !fabricGroup || !obj) return

    // Calculate world position before removing from group
    const matrix = obj.calcTransformMatrix()
    const point = new fabric.Point(matrix[4], matrix[5])

    fabricGroup.remove(obj)
    obj.set({ left: point.x, top: point.y })
    obj.setCoords()
    this.canvas?.add(obj)

    group.childIds = group.childIds.filter((id) => id !== shapeId)
    shape.groupId = null

    this.canvas?.requestRenderAll()
  }

  getGroup(id: string): LayoutGroup | undefined {
    const group = this.groupMap.get(id)
    return group ? { ...group } : undefined
  }

  getAllGroups(): LayoutGroup[] {
    return Array.from(this.groupMap.values()).map((g) => ({ ...g }))
  }

  // ─── Selection ──────────────────────────────────────────────────────────────

  select(ids: string[]): void {
    if (this.disposed || !this.canvas) return
    this.canvas.discardActiveObject()

    const objects = ids
      .map((id) => this.fabricMap.get(id))
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

  addToSelection(ids: string[]): void {
    if (this.disposed || !this.canvas) return
    const current = this.getSelectedIds()
    const merged = [...new Set([...current, ...ids])]
    this.select(merged)
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
        .map((o) => (o as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string)
        .filter(Boolean)
    }

    const id = (active as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string
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
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    this.canvas.requestRenderAll()
    this.emitter.emit('viewportChanged', { panX: 0, panY: 0, zoom: 1 })
  }

  getViewport(): ViewportState {
    if (!this.canvas) return { panX: 0, panY: 0, zoom: 1 }
    const vpt = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    return { panX: -vpt[4] || 0, panY: -vpt[5] || 0, zoom: vpt[0] }
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

  // ─── Private: Grid ──────────────────────────────────────────────────────────

  private drawGrid(): void {
    if (!this.canvas || !this.gridConfig.visible) return

    const size = this.gridConfig.size
    const sub = size / 4
    const { grid, gridOrigin } = this.themeColors

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

    // Subdivision lines
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += sub) {
      if (x % size === 0) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.25)
    }
    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += sub) {
      if (y % size === 0) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.25)
    }

    // Major grid lines
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += size) {
      if (x === 0) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.5)
    }
    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += size) {
      if (y === 0) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.5)
    }

    // Origin crosshair
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

  private setupEventHandlers(): void {
    if (!this.canvas) return

    this.canvas.on('selection:created', () => {
      if (this.disposed) return
      this.emitter.emit('selectionChanged', { ids: this.getSelectedIds() })
    })

    this.canvas.on('selection:updated', () => {
      if (this.disposed) return
      this.emitter.emit('selectionChanged', { ids: this.getSelectedIds() })
    })

    this.canvas.on('selection:cleared', () => {
      if (this.disposed) return
      this.emitter.emit('selectionChanged', { ids: [] })
    })

    // Rects and ellipses: reset scale and update real dimensions so they stay crisp
    // and corner radii remain constant. Polygons/paths are natively vector — let them keep scale.
    this.canvas.on('object:scaling', (e) => {
      if (this.disposed) return
      const obj = e.target
      if (!obj) return
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

    this.canvas.on('object:modified', (e) => {
      if (this.disposed) return
      const obj = e.target
      if (!obj) return
      const id = (obj as unknown as Record<string, unknown>)[SHAPE_DATA_KEY] as string
      if (!id) return

      this.emitter.emit('shapeMoved', { id, x: obj.left ?? 0, y: obj.top ?? 0 })

      // Emit shapeResized with current dimensions
      const data = this.shapeMap.get(id)
      if (data) {
        const shape = fabricObjToLayoutShape(obj, data)
        const resizePayload: EngineEventMap['shapeResized'] = { id }
        if ('width' in shape) resizePayload.width = shape.width
        if ('height' in shape) resizePayload.height = shape.height
        if ('radiusX' in shape) resizePayload.radiusX = shape.radiusX
        if ('radiusY' in shape) resizePayload.radiusY = shape.radiusY
        this.emitter.emit('shapeResized', resizePayload)
      }
    })

    this.canvas.on('mouse:down', () => {
      this.interacting = true
    })

    this.canvas.on('mouse:up', () => {
      this.interacting = false
    })
  }

  // ─── Private: Snap to grid ──────────────────────────────────────────────────

  private setupSnapToGrid(): void {
    if (!this.canvas) return
    this.canvas.on('object:moving', (e) => {
      if (!this.gridConfig.enabled) return
      const obj = e.target
      if (!obj) return
      const size = this.gridConfig.size
      const left = Math.round((obj.left ?? 0) / size) * size
      const top = Math.round((obj.top ?? 0) / size) * size
      obj.set({ left, top })
      obj.setCoords()
    })
  }

  // ─── Private: Pan & Zoom ────────────────────────────────────────────────────
  // TODO(#226): Extract pan/zoom/drag into a shared input manager

  private setupPanZoom(): void {
    if (!this.canvas) return
    let isPanning = false
    let lastX = 0
    let lastY = 0

    this.canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent
      if (e.altKey || e.button === 1) {
        isPanning = true
        lastX = e.clientX
        lastY = e.clientY
        if (this.canvas) this.canvas.selection = false
        e.preventDefault()
      }
    })

    this.canvas.on('mouse:move', (opt) => {
      if (!isPanning || !this.canvas) return
      const e = opt.e as MouseEvent
      const vpt = this.canvas.viewportTransform
      if (!vpt) return
      vpt[4] += e.clientX - lastX
      vpt[5] += e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      this.canvas.setViewportTransform(vpt)
    })

    this.canvas.on('mouse:up', () => {
      if (isPanning && this.canvas) {
        isPanning = false
        this.canvas.selection = true
        this.canvas.setViewportTransform(this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])
        const vp = this.getViewport()
        this.emitter.emit('viewportChanged', vp)
      }
    })

    this.canvas.on('mouse:wheel', (opt) => {
      if (!this.canvas) return
      const e = opt.e as WheelEvent
      let zoom = this.canvas.getZoom()
      zoom *= 0.999 ** e.deltaY
      zoom = Math.min(Math.max(zoom, 0.1), 10)
      this.canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), zoom)
      e.preventDefault()
      e.stopPropagation()
      const vp = this.getViewport()
      this.emitter.emit('viewportChanged', vp)
    })
  }
}

// Auto-register
registerEngine('fabric', FabricEngine)
