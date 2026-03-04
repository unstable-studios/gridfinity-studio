import { useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

interface BinPreviewProps {
  mesh: { positions: Float32Array; indices: Uint32Array; normals: Float32Array }
}

const CLIP_MIN = 0
const CLIP_MAX = 100

function ClipSliderOverlay({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <Html
      as="div"
      position={[0, 0, 0]}
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        pointerEvents: 'auto',
        zIndex: 10
      }}
      calculatePosition={() => [16, 0, 0]}
      wrapperClass=""
    >
      <div
        style={{
          background: 'rgba(10, 12, 18, 0.85)',
          borderRadius: 8,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#c8cad0',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          userSelect: 'none'
        }}
      >
        <span>Clip Z</span>
        <input
          type="range"
          min={CLIP_MIN}
          max={CLIP_MAX}
          step={0.5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 140, accentColor: '#4f9ef8' }}
        />
        <span style={{ minWidth: 36, textAlign: 'right' }}>{value.toFixed(1)}</span>
      </div>
    </Html>
  )
}

export default function BinPreview({ mesh }: BinPreviewProps): React.JSX.Element {
  const [clipZ, setClipZ] = useState(CLIP_MAX)

  const clippingPlanes = useMemo(
    () => [new THREE.Plane(new THREE.Vector3(0, 0, -1), clipZ)],
    [clipZ]
  )

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
    return geo
  }, [mesh.positions, mesh.indices, mesh.normals])

  useFrame(({ gl }) => {
    gl.localClippingEnabled = true
  })

  return (
    <>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#4a8fd4"
          metalness={0.45}
          roughness={0.3}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>
      <ClipSliderOverlay value={clipZ} onChange={setClipZ} />
    </>
  )
}
