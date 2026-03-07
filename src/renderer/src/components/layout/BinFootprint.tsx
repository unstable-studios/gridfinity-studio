import { useMemo } from 'react'
import * as THREE from 'three'

interface BinFootprintProps {
  widthMm: number
  depthMm: number
  position: { x: number; y: number }
  selected?: boolean
  hovered?: boolean
}

export default function BinFootprint({
  widthMm,
  depthMm,
  position,
  selected = false,
  hovered = false
}: BinFootprintProps): React.JSX.Element {
  const lineObj = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(widthMm, 0, 0),
      new THREE.Vector3(widthMm, depthMm, 0),
      new THREE.Vector3(0, depthMm, 0),
      new THREE.Vector3(0, 0, 0)
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    const material = selected
      ? new THREE.LineBasicMaterial({ color: '#3b82f6', opacity: 0.9, transparent: true })
      : hovered
        ? new THREE.LineBasicMaterial({ color: '#fbbf24', opacity: 0.9, transparent: true })
        : new THREE.LineDashedMaterial({
            color: '#f59e0b',
            dashSize: 2,
            gapSize: 1.5,
            opacity: 0.6,
            transparent: true
          })

    const line = new THREE.Line(geometry, material)
    if (!selected && !hovered) line.computeLineDistances()
    return line
  }, [widthMm, depthMm, selected, hovered])

  return (
    <group position={[position.x, position.y, 0]}>
      <primitive object={lineObj} />
      {(selected || hovered) && (
        <mesh position={[widthMm / 2, depthMm / 2, -0.005]}>
          <planeGeometry args={[widthMm, depthMm]} />
          <meshBasicMaterial
            transparent
            opacity={selected ? 0.06 : 0.03}
            color={selected ? '#3b82f6' : '#f59e0b'}
          />
        </mesh>
      )}
    </group>
  )
}
