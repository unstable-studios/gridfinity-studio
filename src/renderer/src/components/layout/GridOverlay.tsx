import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface GridOverlayProps {
  baseUnit: number
  visible?: boolean
  gridColor?: string
}

export default function GridOverlay({
  baseUnit,
  visible = true,
  gridColor = '#3a3f55'
}: GridOverlayProps): React.JSX.Element | null {
  const { camera, size } = useThree()

  const gridGeometry = useMemo(() => {
    const cam = camera as THREE.OrthographicCamera
    const halfW = size.width / cam.zoom / 2
    const halfH = size.height / cam.zoom / 2

    const camX = cam.position.x
    const camY = cam.position.y

    // Compute world-space multiples of baseUnit that fall within the visible area
    const startX = Math.floor((camX - halfW) / baseUnit) * baseUnit
    const endX = Math.ceil((camX + halfW) / baseUnit) * baseUnit
    const startY = Math.floor((camY - halfH) / baseUnit) * baseUnit
    const endY = Math.ceil((camY + halfH) / baseUnit) * baseUnit

    const points: number[] = []

    // Vertical lines
    for (let x = startX; x <= endX; x += baseUnit) {
      points.push(x, startY, 0, x, endY, 0)
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += baseUnit) {
      points.push(startX, y, 0, endX, y, 0)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [baseUnit, camera, size])

  if (!visible) return null

  return (
    <lineSegments geometry={gridGeometry}>
      <lineBasicMaterial color={gridColor} opacity={0.5} transparent />
    </lineSegments>
  )
}
