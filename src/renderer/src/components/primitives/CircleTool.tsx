import { useState, useCallback, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { CircleEntity } from '../../../../shared/types/project'

type ToolState = 'idle' | 'placing'

const MIN_DIAMETER = 1

interface CircleToolProps {
  onPlace: (entity: Partial<CircleEntity>) => void
}

export default function CircleTool({ onPlace }: CircleToolProps): React.JSX.Element | null {
  const [state, setState] = useState<ToolState>('idle')
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null)
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const toWorld = useCallback((event: ThreeEvent<PointerEvent>) => {
    return { x: event.point.x, y: event.point.y }
  }, [])

  const diameter = useMemo(() => {
    if (!center) return 0
    const dx = currentPos.x - center.x
    const dy = currentPos.y - center.y
    return Math.max(Math.sqrt(dx * dx + dy * dy) * 2, MIN_DIAMETER)
  }, [center, currentPos])

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const pos = toWorld(event)

      if (state === 'idle') {
        setCenter(pos)
        setCurrentPos(pos)
        setState('placing')
      } else if (state === 'placing' && center) {
        const finalDiameter = Math.max(
          Math.sqrt((pos.x - center.x) ** 2 + (pos.y - center.y) ** 2) * 2,
          MIN_DIAMETER
        )

        onPlace({
          type: 'circle',
          diameter: finalDiameter,
          transform: {
            position: { x: center.x, y: center.y, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          }
        })

        setState('idle')
        setCenter(null)
      }
    },
    [state, center, toWorld, onPlace]
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (state === 'placing') {
        const pos = toWorld(event)
        setCurrentPos(pos)
      }
    },
    [state, toWorld]
  )

  const previewGeometry = useMemo(() => {
    if (!center || state !== 'placing') return null
    const segments = 64
    const radius = diameter / 2
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [center, state, diameter])

  const previewLine = useMemo(() => {
    if (!previewGeometry) return null
    const material = new THREE.LineBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.6
    })
    return new THREE.Line(previewGeometry, material)
  }, [previewGeometry])

  return (
    <group>
      {/* Invisible plane to capture pointer events */}
      <mesh
        position={[0, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <planeGeometry args={[10000, 10000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Preview circle */}
      {previewLine && center && (
        <primitive object={previewLine} position={[center.x, center.y, 0.02]} />
      )}
    </group>
  )
}
