import { useMemo, useCallback, useState, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'

interface TransformGizmoProps {
  selectedIds: Set<string>
  entities: Entity[]
  onMove: (id: string, dx: number, dy: number) => void
  snap?: (pos: { x: number; y: number }) => { x: number; y: number }
}

export default function TransformGizmo({
  selectedIds,
  entities,
  onMove,
  snap
}: TransformGizmoProps): React.JSX.Element | null {
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const shiftHeld = useRef(false)
  const axisLock = useRef<'x' | 'y' | null>(null)

  const selectedEntities = useMemo(
    () => entities.filter((e) => selectedIds.has(e.id)),
    [entities, selectedIds]
  )

  const centroid = useMemo(() => {
    if (selectedEntities.length === 0) return null
    const sum = selectedEntities.reduce(
      (acc, e) => ({
        x: acc.x + e.transform.position.x,
        y: acc.y + e.transform.position.y
      }),
      { x: 0, y: 0 }
    )
    return {
      x: sum.x / selectedEntities.length,
      y: sum.y / selectedEntities.length
    }
  }, [selectedEntities])

  const crossGeometry = useMemo(() => {
    const size = 3
    const points = [
      new THREE.Vector3(-size, 0, 0),
      new THREE.Vector3(size, 0, 0),
      new THREE.Vector3(0, -size, 0),
      new THREE.Vector3(0, size, 0)
    ]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          points[0].x,
          points[0].y,
          points[0].z,
          points[1].x,
          points[1].y,
          points[1].z,
          points[2].x,
          points[2].y,
          points[2].z,
          points[3].x,
          points[3].y,
          points[3].z
        ],
        3
      )
    )
    return geometry
  }, [])

  const crossLine = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color: '#f59e0b' })
    return new THREE.LineSegments(crossGeometry, material)
  }, [crossGeometry])

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!centroid) return
      event.stopPropagation()
      ;(event.target as HTMLElement).setPointerCapture?.(event.nativeEvent.pointerId)
      const pos = { x: event.point.x, y: event.point.y }
      dragStart.current = pos
      lastPos.current = pos
      shiftHeld.current = event.nativeEvent.shiftKey
      axisLock.current = null
      setDragging(true)
    },
    [centroid]
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragging || !centroid) return

      let pos = { x: event.point.x, y: event.point.y }

      // Update shift state live
      shiftHeld.current = event.nativeEvent.shiftKey

      // Shift-constrain: lock to the dominant axis
      if (shiftHeld.current) {
        const totalDx = pos.x - dragStart.current.x
        const totalDy = pos.y - dragStart.current.y

        // Determine axis lock once movement exceeds a small threshold
        if (!axisLock.current && (Math.abs(totalDx) > 0.5 || Math.abs(totalDy) > 0.5)) {
          axisLock.current = Math.abs(totalDx) >= Math.abs(totalDy) ? 'x' : 'y'
        }

        if (axisLock.current === 'x') {
          pos = { x: pos.x, y: dragStart.current.y }
        } else if (axisLock.current === 'y') {
          pos = { x: dragStart.current.x, y: pos.y }
        }
      } else {
        axisLock.current = null
      }

      if (snap) {
        pos = snap(pos)
      }

      const dx = pos.x - lastPos.current.x
      const dy = pos.y - lastPos.current.y
      lastPos.current = pos

      if (dx !== 0 || dy !== 0) {
        for (const id of selectedIds) {
          onMove(id, dx, dy)
        }
      }
    },
    [dragging, centroid, snap, selectedIds, onMove]
  )

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragging) return
      event.stopPropagation()
      setDragging(false)
      axisLock.current = null
    },
    [dragging]
  )

  if (!centroid || selectedEntities.length === 0) return null

  return (
    <group>
      {/* Cross indicator at centroid */}
      <primitive object={crossLine} position={[centroid.x, centroid.y, 0.05]} />

      {/* Invisible drag handle */}
      <mesh
        position={[centroid.x, centroid.y, 0.04]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial transparent opacity={dragging ? 0.1 : 0} color="#f59e0b" />
      </mesh>

      {/* Full-screen capture plane while dragging */}
      {dragging && (
        <mesh
          position={[0, 0, 0.03]}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[10000, 10000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  )
}
