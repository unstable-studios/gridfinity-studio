import Konva from 'konva'
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
const DEFAULT_GRID_COLOR = '#27272a'
const DEFAULT_GRID_ORIGIN = 'rgba(113, 113, 122, 0.35)'
const GRID_EXTENT = 10000

// ─── Helpers ────────────────────────────────────────────────────────────────────

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
    case 'polygon':
      node = new Konva.Line({
        points: shape.points.flatMap((p) => [p.x, p.y]),
        closed: true
      })
      break
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
  private transformer: Konva.Transformer | null = null

  // Internal state maps
  private shapeMap = new Map<string, LayoutShape>()
  private konvaMap = new Map<string, Konva.Shape>()
  private groupMap = new Map<string, LayoutGroup>()
  private konvaGroupMap = new Map<string, Konva.Group>()
  private gridConfig: GridConfig = { size: 42, enabled: true, visible: true }
  private themeColors = {
    background: DEFAULT_BG,
    grid: DEFAULT_GRID_COLOR,
    gridOrigin: DEFAULT_GRID_ORIGIN
  }
  private bgRect: Konva.Rect | null = null
  private container: HTMLDivElement | null = null

  // Pan state — isPanning is set from a DOM capture listener so it's
  // guaranteed to be true before Konva's internal drag tracking fires.
  private isPanning = false
  private lastPointer = { x: 0, y: 0 }
  private panCaptureHandler: ((e: MouseEvent) => void) | null = null

  // Rubber-band selection state
  private selectionRect: Konva.Rect | null = null
  private selectionStart: { x: number; y: number } | null = null

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  mount(container: HTMLDivElement): void {
    this.container = container
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
      borderStrokeWidth: 1,
      anchorStroke: '#60a5fa',
      anchorFill: '#18181b',
      anchorSize: 8,
      anchorCornerRadius: 2,
      rotateAnchorOffset: 20
    })
    this.mainLayer.add(this.transformer)

    // Add background rect for stage click detection
    this.bgRect = new Konva.Rect({
      x: -GRID_EXTENT,
      y: -GRID_EXTENT,
      width: GRID_EXTENT * 2,
      height: GRID_EXTENT * 2,
      fill: this.themeColors.background,
      listening: true,
      name: 'background'
    })
    this.mainLayer.add(this.bgRect)
    this.bgRect.moveToBottom()

    this.drawGrid()
    this.setupEventHandlers()
    this.setupPanZoom()

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

    if (this.panCaptureHandler && this.container) {
      this.container.removeEventListener('mousedown', this.panCaptureHandler, true)
      this.panCaptureHandler = null
    }
    this.container = null

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
    this.konvaGroupMap.clear()
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

    node.on('dragmove', () => {
      if (this.gridConfig.enabled) {
        const size = this.gridConfig.size
        node.position({
          x: Math.round(node.x() / size) * size,
          y: Math.round(node.y() / size) * size
        })
      }
    })

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

    if (shape.groupId && this.konvaGroupMap.has(shape.groupId)) {
      this.konvaGroupMap.get(shape.groupId)!.add(node)
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

    const konvaGroup = new Konva.Group({
      x: group.x,
      y: group.y,
      rotation: group.rotation,
      draggable: true,
      id: group.id,
      name: 'group'
    })

    // Move children into group
    for (const childId of group.childIds) {
      const node = this.konvaMap.get(childId)
      if (node) {
        // Calculate position relative to group
        const absX = node.x()
        const absY = node.y()
        node.moveTo(konvaGroup)
        node.position({ x: absX - group.x, y: absY - group.y })
      }
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = group.id
    }

    this.konvaGroupMap.set(group.id, konvaGroup)
    this.mainLayer.add(konvaGroup)
    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
  }

  updateGroup(id: string, patch: Partial<LayoutGroup>): void {
    if (this.disposed) return
    const group = this.groupMap.get(id)
    if (!group) return

    Object.assign(group, patch, { id })

    const konvaGroup = this.konvaGroupMap.get(id)
    if (!konvaGroup) return

    if (patch.x !== undefined) konvaGroup.x(patch.x)
    if (patch.y !== undefined) konvaGroup.y(patch.y)
    if (patch.rotation !== undefined) konvaGroup.rotation(patch.rotation)

    this.mainLayer?.batchDraw()
  }

  removeGroup(id: string): void {
    if (this.disposed || !this.mainLayer) return
    const group = this.groupMap.get(id)
    if (!group) return

    const konvaGroup = this.konvaGroupMap.get(id)
    if (konvaGroup) {
      // Ungroup: move children back to main layer at world-space positions
      const children = [...konvaGroup.getChildren()]
      for (const child of children) {
        if (child.name() !== 'shape') continue
        const absPos = child.getAbsolutePosition()
        child.moveTo(this.mainLayer)
        child.position(absPos)
      }
      konvaGroup.destroy()
    }

    for (const childId of group.childIds) {
      const shape = this.shapeMap.get(childId)
      if (shape) shape.groupId = null
    }

    this.groupMap.delete(id)
    this.konvaGroupMap.delete(id)
    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
  }

  addToGroup(shapeId: string, groupId: string): void {
    if (this.disposed) return
    const group = this.groupMap.get(groupId)
    const konvaGroup = this.konvaGroupMap.get(groupId)
    const node = this.konvaMap.get(shapeId)
    const shape = this.shapeMap.get(shapeId)

    if (!group || !konvaGroup || !node || !shape) return

    const absX = node.x()
    const absY = node.y()
    node.moveTo(konvaGroup)
    node.position({ x: absX - konvaGroup.x(), y: absY - konvaGroup.y() })

    group.childIds = [...group.childIds, shapeId]
    shape.groupId = groupId

    this.mainLayer?.batchDraw()
  }

  removeFromGroup(shapeId: string): void {
    if (this.disposed || !this.mainLayer) return
    const shape = this.shapeMap.get(shapeId)
    if (!shape?.groupId) return

    const group = this.groupMap.get(shape.groupId)
    const konvaGroup = this.konvaGroupMap.get(shape.groupId)
    const node = this.konvaMap.get(shapeId)

    if (!group || !konvaGroup || !node) return

    const absPos = node.getAbsolutePosition()
    node.moveTo(this.mainLayer)
    node.position(absPos)

    group.childIds = group.childIds.filter((id) => id !== shapeId)
    shape.groupId = null

    this.transformer?.moveToTop()
    this.mainLayer.batchDraw()
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
    if (this.disposed || !this.transformer) return

    const nodes = ids
      .map((id) => this.konvaMap.get(id))
      .filter((n): n is Konva.Shape => n !== undefined)

    this.transformer.nodes(nodes)

    // Lock ratio only when ALL selected shapes have lockAspectRatio explicitly set
    const shouldLock =
      ids.length > 0 && ids.every((id) => this.shapeMap.get(id)?.lockAspectRatio === true)
    this.transformer.keepRatio(shouldLock)

    this.mainLayer?.batchDraw()
    this.emitter.emit('selectionChanged', { ids: [...ids] })
  }

  addToSelection(ids: string[]): void {
    if (this.disposed || !this.transformer) return
    const currentNodes = this.transformer.nodes()
    const currentIds = currentNodes.map((n) => n.id())
    const merged = [...new Set([...currentIds, ...ids])]
    this.select(merged)
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
    this.stage.position({ x: 0, y: 0 })
    this.stage.scale({ x: 1, y: 1 })
    this.stage.batchDraw()
    this.emitter.emit('viewportChanged', { panX: 0, panY: 0, zoom: 1 })
  }

  getViewport(): ViewportState {
    if (!this.stage) return { panX: 0, panY: 0, zoom: 1 }
    return {
      panX: -this.stage.x() || 0,
      panY: -this.stage.y() || 0,
      zoom: this.stage.scaleX()
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
    if (this.bgRect) {
      this.bgRect.fill(colors.background)
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

  // ─── Private: Grid ──────────────────────────────────────────────────────────

  private drawGrid(): void {
    if (!this.gridLayer || !this.stage || !this.gridConfig.visible) return

    const size = this.gridConfig.size
    const sub = size / 4
    const { grid, gridOrigin } = this.themeColors

    const addLine = (points: number[], stroke: string, strokeWidth: number, opacity = 1): void => {
      this.gridLayer!.add(
        new Konva.Line({ points, stroke, strokeWidth, listening: false, opacity })
      )
    }

    // Subdivision lines
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += sub) {
      if (x % size === 0) continue
      addLine([x, -GRID_EXTENT, x, GRID_EXTENT], grid, 0.25, 0.4)
    }
    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += sub) {
      if (y % size === 0) continue
      addLine([-GRID_EXTENT, y, GRID_EXTENT, y], grid, 0.25, 0.4)
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

    this.gridLayer.batchDraw()
  }

  private redrawGrid(): void {
    if (!this.gridLayer) return
    this.gridLayer.destroyChildren()
    this.drawGrid()
  }

  // ─── Private: Event handlers ────────────────────────────────────────────────

  private setupEventHandlers(): void {
    if (!this.stage) return

    // Click to select / deselect + rubber-band selection
    this.stage.on('mousedown', (e) => {
      if (this.disposed) return
      const nativeEvt = e.evt

      // Ignore pan-initiated clicks
      if (nativeEvt.altKey || nativeEvt.button === 1) return

      const target = e.target

      // Clicked on background → start rubber-band
      if (target === this.stage || target.name() === 'background') {
        if (!nativeEvt.shiftKey) {
          this.clearSelection()
        }
        const pointer = this.stage!.getPointerPosition()
        if (pointer) {
          const scale = this.stage!.scaleX()
          const stagePos = this.stage!.position()
          this.selectionStart = {
            x: (pointer.x - stagePos.x) / scale,
            y: (pointer.y - stagePos.y) / scale
          }
          if (!this.selectionRect) {
            this.selectionRect = new Konva.Rect({
              fill: 'rgba(96, 165, 250, 0.08)',
              stroke: '#60a5fa',
              strokeWidth: 1,
              visible: false,
              listening: false
            })
            this.mainLayer?.add(this.selectionRect)
          }
        }
        return
      }

      // Clicked on a shape
      if (target.name() === 'shape') {
        const id = target.id()
        if (nativeEvt.shiftKey) {
          const current = this.getSelectedIds()
          if (current.includes(id)) {
            this.select(current.filter((sid) => sid !== id))
          } else {
            this.addToSelection([id])
          }
        } else {
          if (!this.getSelectedIds().includes(id)) {
            this.select([id])
          }
        }
      }
    })

    // Rubber-band drag
    this.stage.on('mousemove', (e) => {
      if (!this.selectionStart || !this.selectionRect || !this.stage) return
      const pointer = this.stage.getPointerPosition()
      if (!pointer) return

      const scale = this.stage.scaleX()
      const stagePos = this.stage.position()
      const curX = (pointer.x - stagePos.x) / scale
      const curY = (pointer.y - stagePos.y) / scale

      const x = Math.min(this.selectionStart.x, curX)
      const y = Math.min(this.selectionStart.y, curY)
      const w = Math.abs(curX - this.selectionStart.x)
      const h = Math.abs(curY - this.selectionStart.y)

      this.selectionRect.setAttrs({ x, y, width: w, height: h, visible: true })
      this.mainLayer?.batchDraw()

      // Suppress native event to prevent text selection
      e.evt.preventDefault()
    })

    // Rubber-band release
    this.stage.on('mouseup', () => {
      if (this.selectionStart && this.selectionRect && this.selectionRect.visible()) {
        const selBox = this.selectionRect.getClientRect()
        const hits: string[] = []

        for (const [id, node] of this.konvaMap) {
          const nodeBox = node.getClientRect()
          if (
            nodeBox.x < selBox.x + selBox.width &&
            nodeBox.x + nodeBox.width > selBox.x &&
            nodeBox.y < selBox.y + selBox.height &&
            nodeBox.y + nodeBox.height > selBox.y
          ) {
            hits.push(id)
          }
        }

        if (hits.length > 0) {
          this.select(hits)
        }
      }

      if (this.selectionRect) {
        this.selectionRect.visible(false)
        this.mainLayer?.batchDraw()
      }
      this.selectionStart = null
    })

    this.stage.on('mousedown', () => {
      this.interacting = true
    })
    this.stage.on('mouseup', () => {
      this.interacting = false
    })
  }

  // ─── Private: Pan & Zoom ────────────────────────────────────────────────────

  private setupPanZoom(): void {
    if (!this.stage || !this.container) return

    // TODO(#226): Replace this hack with a proper input manager that owns
    // the event lifecycle. Currently we toggle draggable on every shape to
    // prevent Konva's internal drag system from stealing pan gestures.
    // The input decoupling refactor (#226) will make this unnecessary.
    this.panCaptureHandler = (e: MouseEvent) => {
      if (e.altKey || e.button === 1) {
        this.isPanning = true
        this.lastPointer = { x: e.clientX, y: e.clientY }
        for (const node of this.konvaMap.values()) {
          node.draggable(false)
        }
        e.preventDefault()
      }
    }
    // Capture phase: fires before Konva's internal handlers
    this.container.addEventListener('mousedown', this.panCaptureHandler, true)

    this.stage.on('mousemove', (e) => {
      if (!this.isPanning || !this.stage) return
      const dx = e.evt.clientX - this.lastPointer.x
      const dy = e.evt.clientY - this.lastPointer.y
      this.lastPointer = { x: e.evt.clientX, y: e.evt.clientY }

      this.stage.position({
        x: this.stage.x() + dx,
        y: this.stage.y() + dy
      })
      this.stage.batchDraw()
    })

    this.stage.on('mouseup', () => {
      if (this.isPanning && this.stage) {
        this.isPanning = false
        // Restore draggable on all shapes
        for (const node of this.konvaMap.values()) {
          node.draggable(true)
        }
        const vp = this.getViewport()
        this.emitter.emit('viewportChanged', vp)
      }
    })

    this.stage.on('wheel', (e) => {
      if (!this.stage) return
      e.evt.preventDefault()

      const oldScale = this.stage.scaleX()
      const pointer = this.stage.getPointerPosition()
      if (!pointer) return

      const scaleBy = 1.08
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
      const clamped = Math.max(0.1, Math.min(10, newScale))

      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale
      }

      this.stage.scale({ x: clamped, y: clamped })
      this.stage.position({
        x: pointer.x - mousePointTo.x * clamped,
        y: pointer.y - mousePointTo.y * clamped
      })
      this.stage.batchDraw()

      const vp = this.getViewport()
      this.emitter.emit('viewportChanged', vp)
    })
  }
}

// Auto-register
registerEngine('konva', KonvaEngine)
