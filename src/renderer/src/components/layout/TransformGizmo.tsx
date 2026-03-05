import { useMemo, useCallback, useState, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'

interface TransformGizmoProps {
  selectedIds: Set<string>
  entities: Entity[]
  onMove: (id: string, dx: number, dy: number) => void
  onResize?: (id: string, patch: Partial<Entity>) => void
  snap?: (pos: { x: number; y: number }) => { x: number; y: number }
}

type HandlePosition = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const HANDLE_SIZE = 1.5

export default function TransformGizmo({
  selectedIds,
  entities,
  onMove,
  onResize,
  snap
}: TransformGizmoProps): React.JSX.Element | null {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<HandlePosition | null>(null)
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
      const domTarget = event.nativeEvent.target as HTMLElement | null
      domTarget?.setPointerCapture?.(event.nativeEvent.pointerId)
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

      shiftHeld.current = event.nativeEvent.shiftKey

      if (shiftHeld.current) {
        const totalDx = pos.x - dragStart.current.x
        const totalDy = pos.y - dragStart.current.y

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

  // Resize handle logic
  const handleResizeDown = useCallback(
    (event: ThreeEvent<PointerEvent>, handle: HandlePosition) => {
      event.stopPropagation()
      const domTarget = event.nativeEvent.target as HTMLElement | null
      domTarget?.setPointerCapture?.(event.nativeEvent.pointerId)
      lastPos.current = { x: event.point.x, y: event.point.y }
      setResizing(handle)
    },
    []
  )

  const handleResizeMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!resizing || selectedEntities.length !== 1 || !onResize) return
      const entity = selectedEntities[0]
      const pos = { x: event.point.x, y: event.point.y }
      const dx = pos.x - lastPos.current.x
      const dy = pos.y - lastPos.current.y
      lastPos.current = pos

      if (entity.type === 'rectangle') {
        let { width, height } = entity
        const posUpdate = { ...entity.transform.position }
        if (resizing.includes('e')) {
          width += dx
          posUpdate.x += dx / 2
        }
        if (resizing.includes('w')) {
          width -= dx
          posUpdate.x += dx / 2
        }
        if (resizing.includes('n')) {
          height += dy
          posUpdate.y += dy / 2
        }
        if (resizing.includes('s')) {
          height -= dy
          posUpdate.y += dy / 2
        }
        width = Math.max(1, width)
        height = Math.max(1, height)
        onResize(entity.id, {
          width,
          height,
          transform: { ...entity.transform, position: posUpdate }
        })
      } else if (entity.type === 'circle') {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
        const sign = resizing === 'e' || resizing === 'n' ? 1 : -1
        const diameter = Math.max(1, entity.diameter + delta * sign)
        onResize(entity.id, { diameter })
      }
    },
    [resizing, selectedEntities, onResize]
  )

  const handleResizeUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!resizing) return
      event.stopPropagation()
      setResizing(null)
    },
    [resizing]
  )

  if (!centroid || selectedEntities.length === 0) return null

  // Compute resize handles for single entity selection
  const singleEntity = selectedEntities.length === 1 ? selectedEntities[0] : null
  const handles: Array<{ pos: HandlePosition; x: number; y: number }> = []
  if (singleEntity && onResize) {
    const { x, y } = singleEntity.transform.position
    if (singleEntity.type === 'rectangle') {
      const hw = singleEntity.width / 2
      const hh = singleEntity.height / 2
      handles.push(
        { pos: 'n', x, y: y + hh },
        { pos: 's', x, y: y - hh },
        { pos: 'e', x: x + hw, y },
        { pos: 'w', x: x - hw, y },
        { pos: 'ne', x: x + hw, y: y + hh },
        { pos: 'nw', x: x - hw, y: y + hh },
        { pos: 'se', x: x + hw, y: y - hh },
        { pos: 'sw', x: x - hw, y: y - hh }
      )
    } else if (singleEntity.type === 'circle') {
      const r = singleEntity.diameter / 2
      handles.push(
        { pos: 'n', x, y: y + r },
        { pos: 's', x, y: y - r },
        { pos: 'e', x: x + r, y },
        { pos: 'w', x: x - r, y }
      )
    }
  }

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

      {/* Resize handles */}
      {handles.map((h) => (
        <mesh
          key={h.pos}
          position={[h.x, h.y, 0.06]}
          onPointerDown={(e) => handleResizeDown(e, h.pos)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerOver={(e) => {
            const el = (e.nativeEvent.target as HTMLElement | null)?.closest?.('div')
            if (el) {
              const cursor =
                h.pos === 'n' || h.pos === 's'
                  ? 'ns-resize'
                  : h.pos === 'e' || h.pos === 'w'
                    ? 'ew-resize'
                    : h.pos === 'ne' || h.pos === 'sw'
                      ? 'nesw-resize'
                      : 'nwse-resize'
              el.style.cursor = cursor
            }
          }}
          onPointerOut={(e) => {
            const el = (e.nativeEvent.target as HTMLElement | null)?.closest?.('div')
            if (el) el.style.cursor = ''
          }}
        >
          <circleGeometry args={[HANDLE_SIZE, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      ))}

      {/* Full-screen capture plane while dragging or resizing */}
      {(dragging || resizing) && (
        <mesh
          position={[0, 0, 0.03]}
          onPointerMove={resizing ? handleResizeMove : handlePointerMove}
          onPointerUp={resizing ? handleResizeUp : handlePointerUp}
        >
          <planeGeometry args={[10000, 10000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  )
}
