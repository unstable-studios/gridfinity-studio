import { useMemo } from 'react'
import * as THREE from 'three'

interface BinFootprintProps {
  widthMm: number
  depthMm: number
}

export default function BinFootprint({ widthMm, depthMm }: BinFootprintProps): React.JSX.Element {
  const lineObj = useMemo(() => {
    const hw = widthMm / 2
    const hd = depthMm / 2
    const points = [
      new THREE.Vector3(-hw, -hd, 0),
      new THREE.Vector3(hw, -hd, 0),
      new THREE.Vector3(hw, hd, 0),
      new THREE.Vector3(-hw, hd, 0),
      new THREE.Vector3(-hw, -hd, 0)
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineDashedMaterial({
      color: '#f59e0b',
      dashSize: 2,
      gapSize: 1.5,
      opacity: 0.6,
      transparent: true
    })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return line
  }, [widthMm, depthMm])

  return <primitive object={lineObj} />
}
