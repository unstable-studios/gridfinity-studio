import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface GridOverlayProps {
  baseUnit: number
  visible?: boolean
}

export default function GridOverlay({
  baseUnit,
  visible = true
}: GridOverlayProps): React.JSX.Element | null {
  const { camera, size } = useThree()

  const gridGeometry = useMemo(() => {
    // Calculate visible area from orthographic camera
    const cam = camera as THREE.OrthographicCamera
    const halfW = size.width / cam.zoom / 2
    const halfH = size.height / cam.zoom / 2

    // Grid count from visible area + padding, quantized to steps of 5
    const rawCountX = Math.ceil((halfW * 2) / baseUnit) + 4
    const rawCountY = Math.ceil((halfH * 2) / baseUnit) + 4
    const rawCount = Math.max(rawCountX, rawCountY)
    const gridCount = Math.ceil(rawCount / 5) * 5

    // Center grid on camera position (rounded to nearest baseUnit)
    const cx = Math.round(cam.position.x / baseUnit) * baseUnit
    const cy = Math.round(cam.position.y / baseUnit) * baseUnit

    const points: number[] = []
    const halfSize = (gridCount * baseUnit) / 2

    for (let i = 0; i <= gridCount; i++) {
      const pos = i * baseUnit - halfSize
      // Horizontal line
      points.push(cx - halfSize, cy + pos, 0, cx + halfSize, cy + pos, 0)
      // Vertical line
      points.push(cx + pos, cy - halfSize, 0, cx + pos, cy + halfSize, 0)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [baseUnit, camera, size])

  if (!visible) return null

  return (
    <lineSegments geometry={gridGeometry}>
      <lineBasicMaterial color="#3a3f55" opacity={0.5} transparent />
    </lineSegments>
  )
}
