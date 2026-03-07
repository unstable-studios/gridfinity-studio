import { useState, useCallback, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { RectangleEntity } from '../../../../shared/types/project'
import { Z } from '@/lib/z-layers'

type ToolState = 'idle' | 'placing'

interface RectangleToolProps {
  onPlace: (entity: Partial<RectangleEntity>) => void
}

export default function RectangleTool({ onPlace }: RectangleToolProps): React.JSX.Element | null {
  const [state, setState] = useState<ToolState>('idle')
  const [corner1, setCorner1] = useState<{ x: number; y: number } | null>(null)
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const toWorld = useCallback((event: ThreeEvent<PointerEvent>) => {
    return { x: event.point.x, y: event.point.y }
  }, [])

  const dimensions = useMemo(() => {
    if (!corner1) return { width: 0, height: 0, cx: 0, cy: 0 }
    const width = Math.abs(currentPos.x - corner1.x)
    const height = Math.abs(currentPos.y - corner1.y)
    const cx = (corner1.x + currentPos.x) / 2
    const cy = (corner1.y + currentPos.y) / 2
    return { width, height, cx, cy }
  }, [corner1, currentPos])

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      const pos = toWorld(event)

      if (state === 'idle') {
        setCorner1(pos)
        setCurrentPos(pos)
        setState('placing')
      } else if (state === 'placing' && corner1) {
        const width = Math.abs(pos.x - corner1.x)
        const height = Math.abs(pos.y - corner1.y)
        const cx = (corner1.x + pos.x) / 2
        const cy = (corner1.y + pos.y) / 2

        if (width > 0 && height > 0) {
          onPlace({
            type: 'rectangle',
            width,
            height,
            transform: {
              position: { x: cx, y: cy, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            }
          })
        }

        setState('idle')
        setCorner1(null)
      }
    },
    [state, corner1, toWorld, onPlace]
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
    if (!corner1 || state !== 'placing') return null
    const { width, height } = dimensions
    if (width === 0 && height === 0) return null

    const hw = width / 2
    const hh = height / 2
    const points = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0)
    ]
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [corner1, state, dimensions])

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
        position={[0, 0, Z.GRID]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        visible={false}
      >
        <planeGeometry args={[10000, 10000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Preview rectangle */}
      {previewLine && corner1 && (
        <primitive object={previewLine} position={[dimensions.cx, dimensions.cy, Z.TOOL_PREVIEW]} />
      )}
    </group>
  )
}
