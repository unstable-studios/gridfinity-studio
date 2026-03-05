import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useRef, useCallback, useState, useEffect } from 'react'
import GridOverlay from './GridOverlay'
import EntityRenderer from './EntityRenderer'
import TransformGizmo from './TransformGizmo'
import SelectionBox from './SelectionBox'
import BinFootprint from './BinFootprint'
import CircleTool from '../primitives/CircleTool'
import RectangleTool from '../primitives/RectangleTool'
import PolygonTool from '../primitives/PolygonTool'
import type { Entity } from '../../../../shared/types/project'
import { useAppMode } from '@/hooks/useAppMode'

interface LayoutCanvasProps {
  entities: Entity[]
  selectedIds: Set<string>
  baseUnit?: number
  binWidthUnits?: number
  binDepthUnits?: number
  onPlace: (partial: Partial<Entity> & { type: Entity['type'] }) => void
  onMove: (id: string, dx: number, dy: number) => void
  onResize?: (id: string, patch: Partial<Entity>) => void
  onSelect: (id: string, additive?: boolean) => void
  onClearSelection: () => void
  snap: (pos: { x: number; y: number }) => { x: number; y: number }
}

function LayoutScene({
  entities,
  selectedIds,
  baseUnit,
  binWidthUnits,
  binDepthUnits,
  onPlace,
  onMove,
  onResize,
  onSelect,
  onClearSelection,
  snap
}: {
  entities: Entity[]
  selectedIds: Set<string>
  baseUnit: number
  binWidthUnits: number
  binDepthUnits: number
  onPlace: LayoutCanvasProps['onPlace']
  onMove: LayoutCanvasProps['onMove']
  onResize: LayoutCanvasProps['onResize']
  onSelect: LayoutCanvasProps['onSelect']
  onClearSelection: LayoutCanvasProps['onClearSelection']
  snap: LayoutCanvasProps['snap']
}): React.JSX.Element {
  const { activeTool, setActiveTool } = useAppMode()
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const [marqueeActive, setMarqueeActive] = useState(false)

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
      <color attach="background" args={['#111318']} />
      <GridOverlay baseUnit={baseUnit} />
      <BinFootprint widthMm={binWidthUnits * baseUnit} depthMm={binDepthUnits * baseUnit} />
      <EntityRenderer
        entities={entities}
        selectedIds={selectedIds}
        onEntityClick={handleEntityClick}
      />

      {/* Active tool */}
      {activeTool === 'circle' && <CircleTool onPlace={handleToolPlace} />}
      {activeTool === 'rectangle' && <RectangleTool onPlace={handleToolPlace} />}
      {activeTool === 'polygon' && <PolygonTool onPlace={handleToolPlace} />}

      {/* Selection & transform (only in select mode) */}
      {activeTool === 'select' && (
        <>
          <TransformGizmo
            selectedIds={selectedIds}
            entities={entities}
            onMove={onMove}
            onResize={onResize}
            snap={snap}
          />
          <SelectionBox start={marqueeStart} end={marqueeEnd} visible={marqueeActive} />
          {/* Click-away deselect plane (behind everything, only when no tool active) */}
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
  selectedIds,
  baseUnit = 42,
  binWidthUnits = 1,
  binDepthUnits = 1,
  onPlace,
  onMove,
  onResize,
  onSelect,
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

  const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    // Clamp deltaY magnitude to normalize trackpad vs discrete wheel
    const clamped = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100)
    const steps = clamped / 100
    const factor = Math.pow(ZOOM_STEP, -steps * 3)
    setZoom((z) => clampZoom(z * factor))
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Pan with middle-click or right-click
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
    let minX: number
    let maxX: number
    let minY: number
    let maxY: number

    if (entities.length === 0) {
      // Fit to grid footprint
      const gridW = binWidthUnits * baseUnit
      const gridD = binDepthUnits * baseUnit
      minX = -gridW / 2
      maxX = gridW / 2
      minY = -gridD / 2
      maxY = gridD / 2
    } else {
      minX = Infinity
      maxX = -Infinity
      minY = Infinity
      maxY = -Infinity

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
  }, [entities, baseUnit, binWidthUnits, binDepthUnits])

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
              selectedIds={selectedIds}
              baseUnit={baseUnit}
              binWidthUnits={binWidthUnits}
              binDepthUnits={binDepthUnits}
              onPlace={onPlace}
              onMove={onMove}
              onResize={onResize}
              onSelect={onSelect}
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
          className="w-7 h-7 rounded bg-zinc-800/80 text-zinc-300 text-sm font-bold hover:bg-zinc-700 backdrop-blur"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          -
        </button>
        <span className="text-[10px] text-zinc-400 w-10 text-center font-mono">
          {Math.round(zoom * 25)}%
        </span>
        <button
          type="button"
          className="w-7 h-7 rounded bg-zinc-800/80 text-zinc-300 text-sm font-bold hover:bg-zinc-700 backdrop-blur"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="ml-1 h-7 px-2 rounded bg-zinc-800/80 text-zinc-400 text-[10px] hover:bg-zinc-700 hover:text-zinc-300 backdrop-blur"
          onClick={handleZoomToFit}
          title="Zoom to fit"
        >
          Fit
        </button>
      </div>
    </div>
  )
}
