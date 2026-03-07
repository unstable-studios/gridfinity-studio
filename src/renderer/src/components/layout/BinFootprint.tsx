import { useMemo } from 'react'
import * as THREE from 'three'
import { Z } from '@/lib/z-layers'

// Gridfinity spec corner radius (top edge)
const CORNER_RADIUS = 3.75
// Lip wall thickness (inset for inner line)
const LIP_INSET = 1.2

interface BinFootprintProps {
  widthMm: number
  depthMm: number
  position: { x: number; y: number }
  selected?: boolean
  hovered?: boolean
  hasLip?: boolean
}

function roundedRectPoints(w: number, d: number, r: number, segments = 8): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const cr = Math.min(r, w / 2, d / 2)

  // Four corners: bottom-left, bottom-right, top-right, top-left
  const corners = [
    { cx: cr, cy: cr, startAngle: Math.PI, endAngle: Math.PI * 1.5 },
    { cx: w - cr, cy: cr, startAngle: Math.PI * 1.5, endAngle: Math.PI * 2 },
    { cx: w - cr, cy: d - cr, startAngle: 0, endAngle: Math.PI * 0.5 },
    { cx: cr, cy: d - cr, startAngle: Math.PI * 0.5, endAngle: Math.PI }
  ]

  for (const { cx, cy, startAngle, endAngle } of corners) {
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = startAngle + t * (endAngle - startAngle)
      pts.push(new THREE.Vector3(cx + Math.cos(angle) * cr, cy + Math.sin(angle) * cr, 0))
    }
  }

  // Close the loop
  pts.push(pts[0].clone())
  return pts
}

export default function BinFootprint({
  widthMm,
  depthMm,
  position,
  selected = false,
  hovered = false,
  hasLip = false
}: BinFootprintProps): React.JSX.Element {
  const outlineObj = useMemo(() => {
    const points = roundedRectPoints(widthMm, depthMm, CORNER_RADIUS)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    const material = selected
      ? new THREE.LineBasicMaterial({ color: '#3b82f6', opacity: 0.9, transparent: true })
      : hovered
        ? new THREE.LineBasicMaterial({ color: '#fbbf24', opacity: 0.9, transparent: true })
        : new THREE.LineBasicMaterial({
            color: '#f59e0b',
            opacity: hasLip ? 0.8 : 0.5,
            transparent: true
          })

    return new THREE.Line(geometry, material)
  }, [widthMm, depthMm, selected, hovered, hasLip])

  // Second inner line for lip-enabled bins (inset by ~1.2mm, the lip wall thickness)
  const lipInnerObj = useMemo(() => {
    if (!hasLip || selected) return null
    if (widthMm <= LIP_INSET * 2 || depthMm <= LIP_INSET * 2) return null

    const points = roundedRectPoints(
      widthMm - LIP_INSET * 2,
      depthMm - LIP_INSET * 2,
      CORNER_RADIUS - LIP_INSET
    )
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: '#f59e0b',
      opacity: 0.3,
      transparent: true
    })
    return new THREE.Line(geometry, material)
  }, [widthMm, depthMm, hasLip, selected])

  return (
    <group position={[position.x, position.y, 0]}>
      <primitive object={outlineObj} />
      {lipInnerObj && (
        <group position={[LIP_INSET, LIP_INSET, 0]}>
          <primitive object={lipInnerObj} />
        </group>
      )}
      {(selected || hovered) && (
        <mesh position={[widthMm / 2, depthMm / 2, Z.BIN_FILL]}>
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
