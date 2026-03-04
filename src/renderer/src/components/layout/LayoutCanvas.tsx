import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Suspense, useRef, useCallback, useState } from 'react'
import GridOverlay from './GridOverlay'
import EntityRenderer from './EntityRenderer'
import type { Entity } from '../../../../shared/types/project'
import { useAppMode } from '@/hooks/useAppMode'

interface LayoutCanvasProps {
  entities: Entity[]
  selectedIds?: Set<string>
  baseUnit?: number
  onPointerDown?: (worldPos: { x: number; y: number }, event: React.PointerEvent) => void
  onPointerMove?: (worldPos: { x: number; y: number }, event: React.PointerEvent) => void
  onPointerUp?: (worldPos: { x: number; y: number }, event: React.PointerEvent) => void
}

function LayoutScene({
  entities,
  selectedIds,
  baseUnit
}: {
  entities: Entity[]
  selectedIds?: Set<string>
  baseUnit: number
}): React.JSX.Element {
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={4} near={0.1} far={1000} />
      <ambientLight intensity={1} />
      <color attach="background" args={['#111318']} />
      <GridOverlay baseUnit={baseUnit} />
      <EntityRenderer entities={entities} selectedIds={selectedIds} />
    </>
  )
}

export default function LayoutCanvas({
  entities,
  selectedIds,
  baseUnit = 42,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: LayoutCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(4)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const { activeTool } = useAppMode()

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 }
      const rect = canvasRef.current.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
      return {
        x: ndcX * (rect.width / 2 / zoom) + pan.x,
        y: ndcY * (rect.height / 2 / zoom) + pan.y
      }
    },
    [zoom, pan]
  )

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.5, Math.min(100, z * factor)))
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Middle click for panning
      if (e.button === 1) {
        isPanning.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      if (e.button === 0 && onPointerDown) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        onPointerDown(worldPos, e)
      }
    },
    [screenToWorld, onPointerDown]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        const dx = (e.clientX - lastMouse.current.x) / zoom
        const dy = -(e.clientY - lastMouse.current.y) / zoom
        setPan((p) => ({ x: p.x - dx, y: p.y - dy }))
        lastMouse.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (onPointerMove) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        onPointerMove(worldPos, e)
      }
    },
    [zoom, screenToWorld, onPointerMove]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        isPanning.current = false
        return
      }

      if (onPointerUp) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        onPointerUp(worldPos, e)
      }
    },
    [screenToWorld, onPointerUp]
  )

  const cursor = activeTool === 'select' ? 'default' : 'crosshair'

  return (
    <div
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas
        orthographic
        camera={{ position: [pan.x, pan.y, 100], zoom, near: 0.1, far: 1000 }}
        dpr={[1, 1.75]}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <LayoutScene entities={entities} selectedIds={selectedIds} baseUnit={baseUnit} />
        </Suspense>
      </Canvas>
    </div>
  )
}
