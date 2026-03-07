import { useMemo } from 'react'
import * as THREE from 'three'
import { computeKeepOut } from '@/lib/keep-out'
import type { Bin, GridfinityConfig } from '../../../../shared/types/project'
import { Z } from '@/lib/z-layers'

interface KeepOutOverlayProps {
  bin: Bin
  config: GridfinityConfig
}

const KEEP_OUT_COLOR = '#f87171'
const KEEP_OUT_OPACITY = 0.15
const LIP_COLOR = '#fbbf24'
const LIP_OPACITY = 0.08

export default function KeepOutOverlay({ bin, config }: KeepOutOverlayProps): React.JSX.Element {
  const baseUnit = config.baseUnit
  const binCenterX = bin.position.x + (bin.width * baseUnit) / 2
  const binCenterY = bin.position.y + (bin.depth * baseUnit) / 2

  const keepOut = useMemo(
    () => computeKeepOut(bin.width, bin.depth, config, bin.hasStackingLip),
    [bin.width, bin.depth, config, bin.hasStackingLip]
  )

  const lipGeometry = useMemo(() => {
    if (!keepOut.lipInset) return null
    const w = bin.width * baseUnit
    const d = bin.depth * baseUnit
    const inset = keepOut.lipInset.inset
    const hw = w / 2
    const hh = d / 2

    // Outer rect
    const shape = new THREE.Shape()
    shape.moveTo(-hw, -hh)
    shape.lineTo(hw, -hh)
    shape.lineTo(hw, hh)
    shape.lineTo(-hw, hh)
    shape.closePath()

    // Inner hole
    const hole = new THREE.Path()
    hole.moveTo(-hw + inset, -hh + inset)
    hole.lineTo(hw - inset, -hh + inset)
    hole.lineTo(hw - inset, hh - inset)
    hole.lineTo(-hw + inset, hh - inset)
    hole.closePath()
    shape.holes.push(hole)

    return new THREE.ShapeGeometry(shape)
  }, [bin.width, bin.depth, baseUnit, keepOut.lipInset])

  return (
    <group>
      {/* Magnet/screw hole keep-out circles */}
      {keepOut.circles.map((circle, i) => (
        <mesh
          key={i}
          position={[binCenterX + circle.cx, binCenterY + circle.cy, Z.KEEPOUT_OVERLAY]}
        >
          <circleGeometry args={[circle.radius, 24]} />
          <meshBasicMaterial color={KEEP_OUT_COLOR} transparent opacity={KEEP_OUT_OPACITY} />
        </mesh>
      ))}

      {/* Lip inset band */}
      {lipGeometry && (
        <mesh position={[binCenterX, binCenterY, Z.KEEPOUT_OVERLAY]} geometry={lipGeometry}>
          <meshBasicMaterial color={LIP_COLOR} transparent opacity={LIP_OPACITY} />
        </mesh>
      )}
    </group>
  )
}
