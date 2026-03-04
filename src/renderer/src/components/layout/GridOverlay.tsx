import { useMemo } from 'react'
import * as THREE from 'three'

interface GridOverlayProps {
  baseUnit: number
  gridCount?: number
  visible?: boolean
}

export default function GridOverlay({
  baseUnit,
  gridCount = 20,
  visible = true
}: GridOverlayProps): React.JSX.Element | null {
  const gridGeometry = useMemo(() => {
    const points: number[] = []
    const halfSize = (gridCount * baseUnit) / 2

    for (let i = 0; i <= gridCount; i++) {
      const pos = i * baseUnit - halfSize
      // Horizontal line
      points.push(-halfSize, pos, 0, halfSize, pos, 0)
      // Vertical line
      points.push(pos, -halfSize, 0, pos, halfSize, 0)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [baseUnit, gridCount])

  if (!visible) return null

  return (
    <lineSegments geometry={gridGeometry}>
      <lineBasicMaterial color="#3a3f55" opacity={0.5} transparent />
    </lineSegments>
  )
}
