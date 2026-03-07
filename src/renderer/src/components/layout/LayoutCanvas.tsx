import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useRef, useCallback, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import GridOverlay from './GridOverlay'
import EntityRenderer from './EntityRenderer'
import EntityInteractionManager from './EntityInteractionManager'
import BinInteractionManager from './BinInteractionManager'
import TransformGizmo from './TransformGizmo'
import SelectionBox from './SelectionBox'
import BinFootprint from './BinFootprint'
import KeepOutOverlay from './KeepOutOverlay'
import CircleTool from '../primitives/CircleTool'
import RectangleTool from '../primitives/RectangleTool'
import PolygonTool from '../primitives/PolygonTool'
import { detectCollisions } from '@/lib/collision'
import { entityBounds, boundsOverlap } from '../../../../shared/geometry/entity-geometry'
import { Z } from '@/lib/z-layers'
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
  onMoveEnd?: (ids: Set<string>) => void
  onResize?: (id: string, patch: Partial<Entity>) => void
  onBinMove: (id: string, dx: number, dy: number) => void
  onBinResize?: (id: string, patch: Partial<Bin>) => void
  onSelect: (id: string, additive?: boolean) => void
  onSelectBin: (id: string, additive?: boolean) => void
  onMarqueeSelect: (ids: string[]) => void
  onClearSelection: () => void
  snap: (pos: { x: number; y: number }) => { x: number; y: number }
}

function MultiSelectionBounds({
  selectedIds,
  selectionType,
  entities,
  bins,
  baseUnit
}: {
  selectedIds: Set<string>
  selectionType: SelectionType
  entities: Entity[]
  bins: Bin[]
  baseUnit: number
}): React.JSX.Element | null {
  const lineObj = useMemo(() => {
    if (selectedIds.size < 2) return null

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    if (selectionType === 'entity') {
      for (const e of entities) {
        if (!selectedIds.has(e.id)) continue
        const bounds = entityBounds(e)
        if (!bounds) continue
        minX = Math.min(minX, bounds.minX)
        maxX = Math.max(maxX, bounds.maxX)
        minY = Math.min(minY, bounds.minY)
        maxY = Math.max(maxY, bounds.maxY)
      }
    } else {
      for (const b of bins) {
        if (!selectedIds.has(b.id)) continue
        minX = Math.min(minX, b.position.x)
        maxX = Math.max(maxX, b.position.x + b.width * baseUnit)
        minY = Math.min(minY, b.position.y)
        maxY = Math.max(maxY, b.position.y + b.depth * baseUnit)
      }
    }

    if (!isFinite(minX)) return null

    const pad = 2
    const points = [
      new THREE.Vector3(minX - pad, minY - pad, 0),
      new THREE.Vector3(maxX + pad, minY - pad, 0),
      new THREE.Vector3(maxX + pad, maxY + pad, 0),
      new THREE.Vector3(minX - pad, maxY + pad, 0),
      new THREE.Vector3(minX - pad, minY - pad, 0)
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineDashedMaterial({
      color: '#3b82f6',
      dashSize: 3,
      gapSize: 2,
      opacity: 0.5,
      transparent: true
    })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return line
  }, [selectedIds, selectionType, entities, bins, baseUnit])

  if (!lineObj) return null

  return <primitive object={lineObj} position={[0, 0, Z.TOOL_PREVIEW]} />
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
  lightMode,
  onPlace,
  onMove,
  onMoveEnd,
  onResize,
  onBinMove,
  onBinResize,
  onSelect,
  onSelectBin,
  onMarqueeSelect,
  onClearSelection,
  snap
}: {
  bgColor: string
  gridColor: string
  lightMode: boolean
  entities: Entity[]
  bins: Bin[]
  selectedIds: Set<string>
  selectionType: SelectionType
  baseUnit: number
  gridfinityConfig?: GridfinityConfig
  onPlace: LayoutCanvasProps['onPlace']
  onMove: LayoutCanvasProps['onMove']
  onMoveEnd: LayoutCanvasProps['onMoveEnd']
  onResize: LayoutCanvasProps['onResize']
  onBinMove: LayoutCanvasProps['onBinMove']
  onBinResize: LayoutCanvasProps['onBinResize']
  onSelect: LayoutCanvasProps['onSelect']
  onSelectBin: LayoutCanvasProps['onSelectBin']
  onMarqueeSelect: LayoutCanvasProps['onMarqueeSelect']
  onClearSelection: LayoutCanvasProps['onClearSelection']
  snap: LayoutCanvasProps['snap']
}): React.JSX.Element {
  const { activeTool, setActiveTool } = useAppMode()
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const [marqueeActive, setMarqueeActive] = useState(false)
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null)
  const [hoveredBinId, setHoveredBinId] = useState<string | null>(null)

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

  const handleEntityClick = (id: string, additive: boolean): void => {
    onSelect(id, additive)
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
            hovered={hoveredBinId === bin.id}
            hasLip={bin.hasStackingLip}
          />
          {gridfinityConfig && <KeepOutOverlay bin={bin} config={gridfinityConfig} />}
        </group>
      ))}

      {/* Bin interaction managers (only in select mode) */}
      {activeTool === 'select' &&
        bins.map((bin) => (
          <BinInteractionManager
            key={`drag-${bin.id}`}
            bin={bin}
            baseUnit={baseUnit}
            selected={selectionType === 'bin' && selectedIds.has(bin.id)}
            selectedBinIds={selectionType === 'bin' ? selectedIds : new Set()}
            allBins={bins}
            otherBins={bins.filter((b) => b.id !== bin.id)}
            onSelectBin={onSelectBin}
            onBinMove={onBinMove}
            onBinResize={onBinResize}
            onBinHover={setHoveredBinId}
          />
        ))}

      <EntityRenderer
        entities={entities}
        selectedIds={selectionType === 'entity' ? selectedIds : new Set()}
        collidingIds={collidingIds}
        hoveredId={hoveredEntityId}
        lightMode={lightMode}
      />

      {/* Entity interaction manager (only in select mode) */}
      {activeTool === 'select' && (
        <EntityInteractionManager
          entities={entities}
          onEntityClick={handleEntityClick}
          onEntityHover={setHoveredEntityId}
        />
      )}

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
              onMoveEnd={onMoveEnd}
              onResize={onResize}
              snap={snap}
            />
          )}
          <MultiSelectionBounds
            selectedIds={selectedIds}
            selectionType={selectionType}
            entities={entities}
            bins={bins}
            baseUnit={baseUnit}
          />
          <SelectionBox start={marqueeStart} end={marqueeEnd} visible={marqueeActive} />
          {/* Click-away deselect plane */}
          <mesh
            position={[0, 0, Z.BACKGROUND_PLANE]}
            onPointerDown={(e) => {
              if (e.nativeEvent.button !== 0) return
              const additive =
                e.nativeEvent.shiftKey || e.nativeEvent.metaKey || e.nativeEvent.ctrlKey
              if (!additive) onClearSelection()
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
              if (marqueeActive && marqueeStart && marqueeEnd) {
                const minX = Math.min(marqueeStart.x, marqueeEnd.x)
                const maxX = Math.max(marqueeStart.x, marqueeEnd.x)
                const minY = Math.min(marqueeStart.y, marqueeEnd.y)
                const maxY = Math.max(marqueeStart.y, marqueeEnd.y)
                // Only trigger if the marquee has meaningful size
                if (maxX - minX > 0.5 || maxY - minY > 0.5) {
                  const marqueeBounds = { minX, maxX, minY, maxY }
                  const hit = entities
                    .filter((e) => e.visible)
                    .filter((e) => {
                      const bounds = entityBounds(e)
                      return bounds !== null && boundsOverlap(marqueeBounds, bounds)
                    })
                    .map((e) => e.id)
                  if (hit.length > 0) onMarqueeSelect(hit)
                }
              }
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
  onMoveEnd,
  onResize,
  onBinMove,
  onBinResize,
  onSelect,
  onSelectBin,
  onMarqueeSelect,
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
      const bounds = entityBounds(entity)
      if (!bounds) continue
      minX = Math.min(minX, bounds.minX)
      maxX = Math.max(maxX, bounds.maxX)
      minY = Math.min(minY, bounds.minY)
      maxY = Math.max(maxY, bounds.maxY)
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
              lightMode={resolvedTheme === 'light'}
              onPlace={onPlace}
              onMove={onMove}
              onMoveEnd={onMoveEnd}
              onResize={onResize}
              onBinMove={onBinMove}
              onBinResize={onBinResize}
              onSelect={onSelect}
              onSelectBin={onSelectBin}
              onMarqueeSelect={onMarqueeSelect}
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
