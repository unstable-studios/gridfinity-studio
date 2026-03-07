import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { PolygonEntity, Vertex2D } from '../../../../shared/types/project'
import { normalizePolygonVertices } from '../../../../shared/geometry/entity-geometry'

const MIN_VERTICES = 3
const VERTEX_DOT_SIZE = 0.5
const CLOSE_SNAP_RADIUS = 2

interface PolygonToolProps {
  onPlace: (entity: Partial<PolygonEntity>) => void
}

export default function PolygonTool({ onPlace }: PolygonToolProps): React.JSX.Element | null {
  const [vertices, setVertices] = useState<Vertex2D[]>([])
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const toWorld = useCallback((event: ThreeEvent<PointerEvent | MouseEvent>) => {
    return { x: event.point.x, y: event.point.y }
  }, [])

  const closePolygon = useCallback(() => {
    if (vertices.length >= MIN_VERTICES) {
      const { centroid, localVertices } = normalizePolygonVertices(vertices)
      onPlace({
        type: 'polygon',
        vertices: localVertices,
        transform: {
          position: { x: centroid.x, y: centroid.y, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      })
      setVertices([])
    }
  }, [vertices, onPlace])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        closePolygon()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePolygon])

  const isNearStart = useMemo(() => {
    if (vertices.length < MIN_VERTICES) return false
    const start = vertices[0]
    const dx = currentPos.x - start.x
    const dy = currentPos.y - start.y
    return Math.sqrt(dx * dx + dy * dy) <= CLOSE_SNAP_RADIUS
  }, [vertices, currentPos])

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const pos = toWorld(event)

      // If near the start vertex and we have enough vertices, close the polygon
      if (vertices.length >= MIN_VERTICES) {
        const start = vertices[0]
        const dx = pos.x - start.x
        const dy = pos.y - start.y
        if (Math.sqrt(dx * dx + dy * dy) <= CLOSE_SNAP_RADIUS) {
          closePolygon()
          return
        }
      }

      setVertices((prev) => [...prev, pos])
    },
    [toWorld, vertices, closePolygon]
  )

  const handleDoubleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      closePolygon()
    },
    [closePolygon]
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const pos = toWorld(event)
      setCurrentPos(pos)
    },
    [toWorld]
  )

  const linesGeometry = useMemo(() => {
    if (vertices.length < 1) return null
    const points = vertices.map((v) => new THREE.Vector3(v.x, v.y, 0))
    points.push(new THREE.Vector3(currentPos.x, currentPos.y, 0))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [vertices, currentPos])

  const linesObject = useMemo(() => {
    if (!linesGeometry) return null
    const material = new THREE.LineBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.6
    })
    return new THREE.Line(linesGeometry, material)
  }, [linesGeometry])

  return (
    <group>
      {/* Invisible plane to capture pointer events */}
      <mesh
        position={[0, 0, 0]}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <planeGeometry args={[10000, 10000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Vertex dots */}
      {vertices.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, 0.02]}>
          <circleGeometry args={[VERTEX_DOT_SIZE, 16]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      ))}

      {/* Snap-to-close indicator on start vertex */}
      {isNearStart && vertices.length > 0 && (
        <mesh position={[vertices[0].x, vertices[0].y, 0.01]}>
          <ringGeometry args={[CLOSE_SNAP_RADIUS * 0.6, CLOSE_SNAP_RADIUS * 0.8, 32]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Connecting lines + preview line to cursor */}
      {linesObject && <primitive object={linesObject} position={[0, 0, 0.02]} />}
    </group>
  )
}
