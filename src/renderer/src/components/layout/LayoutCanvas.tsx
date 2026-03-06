import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useRef, useCallback, useState, useEffect, useMemo } from 'react'
import GridOverlay from './GridOverlay'
import EntityRenderer from './EntityRenderer'
import TransformGizmo from './TransformGizmo'
import SelectionBox from './SelectionBox'
import BinFootprint from './BinFootprint'
import KeepOutOverlay from './KeepOutOverlay'
import CircleTool from '../primitives/CircleTool'
import RectangleTool from '../primitives/RectangleTool'
import PolygonTool from '../primitives/PolygonTool'
import { detectCollisions } from '@/lib/collision'
import type { Entity, Bin, GridfinityConfig } from '../../../../shared/types/project'
import type { SelectionType } from '@/hooks/useSelection'
import { useAppMode } from '@/hooks/useAppMode'
import { useTheme } from '@unstable-studios/ui'
import { resolveColors } from '@/lib/theme-config'

interface LayoutCanvasProps {
  entities: Entity[]
  bins: Bin[]
  selectedIds: Set<string>
  selectionType: SelectionType
  baseUnit?: number
  gridfinityConfig?: GridfinityConfig
  onPlace: (partial: Partial<Entity> & { type: Entity['type'] }) => void
  onMove: (id: string, dx: number, dy: number) => void
  onResize?: (id: string, patch: Partial<Entity>) => void
  onBinMove: (id: string, position: { x: number; y: number }) => void
  onSelect: (id: string, additive?: boolean) => void
  onSelectBin: (id: string) => void
  onClearSelection: () => void
  snap: (pos: { x: number; y: number }) => { x: number; y: number }
}

/** Check if a bin at candidatePos would overlap any of the other bins. */
function wouldOverlapBins(
  candidate: { x: number; y: number; w: number; d: number },
  others: Array<{ x: number; y: number; w: number; d: number }>
): boolean {
  for (const o of others) {
    if (
      candidate.x < o.x + o.w &&
      candidate.x + candidate.w > o.x &&
      candidate.y < o.y + o.d &&
      candidate.y + candidate.d > o.y
    ) {
      return true
    }
  }
  return false
}

function BinDragHandler({
  bin,
  baseUnit,
  otherBins,
  onSelectBin,
  onBinMove
}: {
  bin: Bin
  baseUnit: number
  otherBins: Bin[]
  onSelectBin: (id: string) => void
  onBinMove: (id: string, position: { x: number; y: number }) => void
}): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  const widthMm = bin.width * baseUnit
  const depthMm = bin.depth * baseUnit
  const cx = bin.position.x + widthMm / 2
  const cy = bin.position.y + depthMm / 2

  // Pre-compute other bin rects for collision checks
  const otherRects = useMemo(
    () =>
      otherBins.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        w: b.width * baseUnit,
        d: b.depth * baseUnit
      })),
    [otherBins, baseUnit]
  )

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.nativeEvent.button !== 0) return
      e.stopPropagation()
      onSelectBin(bin.id)
      offsetRef.current = {
        x: e.point.x - bin.position.x,
        y: e.point.y - bin.position.y
      }
      setDragging(true)
    },
    [bin.id, bin.position.x, bin.position.y, onSelectBin]
  )

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging) return
      e.stopPropagation()
      const rawX = e.point.x - offsetRef.current.x
      const rawY = e.point.y - offsetRef.current.y
      const snappedX = Math.round(rawX / baseUnit) * baseUnit
      const snappedY = Math.round(rawY / baseUnit) * baseUnit
      if (snappedX === bin.position.x && snappedY === bin.position.y) return

      // Reject move if it would overlap another bin
      const candidate = { x: snappedX, y: snappedY, w: widthMm, d: depthMm }
      if (wouldOverlapBins(candidate, otherRects)) return

      onBinMove(bin.id, { x: snappedX, y: snappedY })
    },
    [
      dragging,
      baseUnit,
      bin.id,
      bin.position.x,
      bin.position.y,
      widthMm,
      depthMm,
      otherRects,
      onBinMove
    ]
  )

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging) return
      e.stopPropagation()
      setDragging(false)
    },
    [dragging]
  )

  return (
    <>
      {/* Hit area over the bin footprint */}
      <mesh
        position={[cx, cy, 0.001]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[widthMm, depthMm]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Full-screen capture plane while dragging */}
      {dragging && (
        <mesh
          position={[0, 0, 0.002]}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[10000, 10000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  )
}

function LayoutScene({
  entities,
  bins,
  selectedIds,
  selectionType,
  baseUnit,
  gridfinityConfig,
  bgColor,
  gridColor,
  onPlace,
  onMove,
  onResize,
  onBinMove,
  onSelect,
  onSelectBin,
  onClearSelection,
  snap
}: {
  bgColor: string
  gridColor: string
  entities: Entity[]
  bins: Bin[]
  selectedIds: Set<string>
  selectionType: SelectionType
  baseUnit: number
  gridfinityConfig?: GridfinityConfig
  onPlace: LayoutCanvasProps['onPlace']
  onMove: LayoutCanvasProps['onMove']
  onResize: LayoutCanvasProps['onResize']
  onBinMove: LayoutCanvasProps['onBinMove']
  onSelect: LayoutCanvasProps['onSelect']
  onSelectBin: LayoutCanvasProps['onSelectBin']
  onClearSelection: LayoutCanvasProps['onClearSelection']
  snap: LayoutCanvasProps['snap']
}): React.JSX.Element {
  const { activeTool, setActiveTool } = useAppMode()
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const [marqueeActive, setMarqueeActive] = useState(false)

  // Compute colliding entity IDs for visual warning
  const collidingIds = useMemo(() => {
    const pairs = detectCollisions(entities)
    const ids = new Set<string>()
    for (const { a, b } of pairs) {
      ids.add(a)
      ids.add(b)
    }
    return ids
  }, [entities])

  const handleToolPlace = (partial: Partial<Entity>): void => {
    if (!partial.type) return
    onPlace(partial as Partial<Entity> & { type: Entity['type'] })
    setActiveTool('select')
  }

  const handleEntityClick = (id: string, shiftKey: boolean): void => {
    onSelect(id, shiftKey)
  }

  return (
    <>
      <ambientLight intensity={1} />
      <color attach="background" args={[bgColor]} />
      <GridOverlay baseUnit={baseUnit} gridColor={gridColor} />

      {/* Multi-bin footprints + keep-out overlays */}
      {bins.map((bin) => (
        <group key={bin.id}>
          <BinFootprint
            widthMm={bin.width * baseUnit}
            depthMm={bin.depth * baseUnit}
            position={bin.position}
            selected={selectionType === 'bin' && selectedIds.has(bin.id)}
          />
          {gridfinityConfig && <KeepOutOverlay bin={bin} config={gridfinityConfig} />}
        </group>
      ))}

      {/* Bin drag handlers (only in select mode) */}
      {activeTool === 'select' &&
        bins.map((bin) => (
          <BinDragHandler
            key={`drag-${bin.id}`}
            bin={bin}
            baseUnit={baseUnit}
            otherBins={bins.filter((b) => b.id !== bin.id)}
            onSelectBin={onSelectBin}
            onBinMove={onBinMove}
          />
        ))}

      <EntityRenderer
        entities={entities}
        selectedIds={selectionType === 'entity' ? selectedIds : new Set()}
        collidingIds={collidingIds}
        onEntityClick={activeTool === 'select' ? handleEntityClick : undefined}
      />

      {/* Active tool */}
      {activeTool === 'circle' && <CircleTool onPlace={handleToolPlace} />}
      {activeTool === 'rectangle' && <RectangleTool onPlace={handleToolPlace} />}
      {activeTool === 'polygon' && <PolygonTool onPlace={handleToolPlace} />}

      {/* Selection & transform (only in select mode, only for entity selections) */}
      {activeTool === 'select' && (
        <>
          {selectionType === 'entity' && (
            <TransformGizmo
              selectedIds={selectedIds}
              entities={entities}
              onMove={onMove}
              onResize={onResize}
              snap={snap}
            />
          )}
          <SelectionBox start={marqueeStart} end={marqueeEnd} visible={marqueeActive} />
          {/* Click-away deselect plane */}
          <mesh
            position={[0, 0, -0.01]}
            onPointerDown={(e) => {
              if (e.nativeEvent.button !== 0) return
              onClearSelection()
              const pos = { x: e.point.x, y: e.point.y }
              setMarqueeStart(pos)
              setMarqueeEnd(pos)
              setMarqueeActive(true)
            }}
            onPointerMove={(e) => {
              if (marqueeActive) {
                setMarqueeEnd({ x: e.point.x, y: e.point.y })
              }
            }}
            onPointerUp={() => {
              setMarqueeActive(false)
              setMarqueeStart(null)
              setMarqueeEnd(null)
            }}
          >
            <planeGeometry args={[10000, 10000]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </>
      )}
    </>
  )
}

// Imperatively syncs camera with pan/zoom state from outside the canvas
function CameraController({ pan, zoom }: { pan: { x: number; y: number }; zoom: number }): null {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(pan.x, pan.y, 100)
    // eslint-disable-next-line react-hooks/immutability -- r3f camera must be mutated imperatively
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }, [camera, pan.x, pan.y, zoom])

  return null
}

const INITIAL_ZOOM = 4
const MIN_ZOOM = 0.5
const MAX_ZOOM = 100
const ZOOM_STEP = 1.06

export default function LayoutCanvas({
  entities,
  bins,
  selectedIds,
  selectionType,
  baseUnit = 42,
  gridfinityConfig,
  onPlace,
  onMove,
  onResize,
  onBinMove,
  onSelect,
  onSelectBin,
  onClearSelection,
  snap
}: LayoutCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panCursor, setPanCursor] = useState(false)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const { activeTool } = useAppMode()
  const { resolvedTheme } = useTheme()
  const colors = resolveColors(resolvedTheme)

  const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const clamped = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100)
    const steps = clamped / 100
    const factor = Math.pow(ZOOM_STEP, -steps * 3)
    setZoom((z) => clampZoom(z * factor))
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true
      setPanCursor(true)
      lastMouse.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        const dx = -(e.clientX - lastMouse.current.x) / zoom
        const dy = (e.clientY - lastMouse.current.y) / zoom
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
        lastMouse.current = { x: e.clientX, y: e.clientY }
      }
    },
    [zoom]
  )

  const handlePointerUp = useCallback(() => {
    isPanning.current = false
    setPanCursor(false)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z * ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z / ZOOM_STEP))
  }, [])

  const handleZoomToFit = useCallback(() => {
    // Compute bounding box from ALL bins
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const bin of bins) {
      const bx = bin.position.x
      const by = bin.position.y
      const bw = bin.width * baseUnit
      const bd = bin.depth * baseUnit
      minX = Math.min(minX, bx)
      maxX = Math.max(maxX, bx + bw)
      minY = Math.min(minY, by)
      maxY = Math.max(maxY, by + bd)
    }

    // Also include entities
    for (const entity of entities) {
      const { x, y } = entity.transform.position
      let halfW = 5
      let halfH = 5

      if (entity.type === 'circle') {
        halfW = halfH = entity.diameter / 2
      } else if (entity.type === 'rectangle') {
        halfW = entity.width / 2
        halfH = entity.height / 2
      } else if (entity.type === 'polygon') {
        for (const v of entity.vertices) {
          halfW = Math.max(halfW, Math.abs(v.x - x))
          halfH = Math.max(halfH, Math.abs(v.y - y))
        }
      }

      minX = Math.min(minX, x - halfW)
      maxX = Math.max(maxX, x + halfW)
      minY = Math.min(minY, y - halfH)
      maxY = Math.max(maxY, y + halfH)
    }

    // Fallback if no bins and no entities
    if (!isFinite(minX)) {
      minX = 0
      maxX = baseUnit
      minY = 0
      maxY = baseUnit
    }

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const contentW = maxX - minX
    const contentH = maxY - minY

    const container = canvasRef.current
    if (!container) return
    const viewW = container.clientWidth
    const viewH = container.clientHeight

    const padding = 1.2
    const fitZoom = Math.min(viewW / (contentW * padding), viewH / (contentH * padding))

    setPan({ x: cx, y: cy })
    setZoom(clampZoom(fitZoom))
  }, [entities, bins, baseUnit])

  const cursor = panCursor ? 'grabbing' : activeTool === 'select' ? 'default' : 'crosshair'

  return (
    <div ref={canvasRef} className="relative w-full h-full" style={{ cursor }}>
      <div
        className="w-full h-full"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
      >
        <Canvas
          orthographic
          camera={{ position: [0, 0, 100], zoom: INITIAL_ZOOM, near: 0.1, far: 1000 }}
          dpr={[1, 1.75]}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true }}
        >
          <CameraController pan={pan} zoom={zoom} />
          <Suspense fallback={null}>
            <LayoutScene
              entities={entities}
              bins={bins}
              selectedIds={selectedIds}
              selectionType={selectionType}
              baseUnit={baseUnit}
              gridfinityConfig={gridfinityConfig}
              bgColor={colors.layoutBg}
              gridColor={colors.layoutGrid}
              onPlace={onPlace}
              onMove={onMove}
              onResize={onResize}
              onBinMove={onBinMove}
              onSelect={onSelect}
              onSelectBin={onSelectBin}
              onClearSelection={onClearSelection}
              snap={snap}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* On-screen viewport controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1">
        <button
          type="button"
          className="w-7 h-7 rounded bg-white/80 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 backdrop-blur"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          -
        </button>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 w-10 text-center font-mono">
          {Math.round(zoom * 25)}%
        </span>
        <button
          type="button"
          className="w-7 h-7 rounded bg-white/80 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 backdrop-blur"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="ml-1 h-7 px-2 rounded bg-white/80 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400 text-[10px] hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 backdrop-blur"
          onClick={handleZoomToFit}
          title="Zoom to fit"
        >
          Fit
        </button>
      </div>
    </div>
  )
}
