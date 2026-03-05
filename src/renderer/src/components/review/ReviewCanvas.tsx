import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import type { AuxMesh } from '@/hooks/useProject'

interface ReviewCanvasProps {
  bakedMesh?: { positions: Float32Array; indices: Uint32Array; normals: Float32Array } | null
  auxMeshes?: AuxMesh[]
}

function ReviewScene({ bakedMesh, auxMeshes }: ReviewCanvasProps): React.JSX.Element {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <pointLight position={[-6, -4, -6]} intensity={0.45} />
      <OrbitControls enableDamping makeDefault />

      {bakedMesh ? <BakedMeshPreview mesh={bakedMesh} /> : <EmptyState />}

      {auxMeshes?.map((aux) => (
        <AuxMeshPreview key={aux.entityId} aux={aux} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0c0f17" roughness={1} />
      </mesh>
    </>
  )
}

function BakedMeshPreview({
  mesh
}: {
  mesh: { positions: Float32Array; indices: Uint32Array; normals: Float32Array }
}): React.JSX.Element {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
    return geo
  }, [mesh.positions, mesh.indices, mesh.normals])

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#4f9ef8" metalness={0.15} roughness={0.35} />
    </mesh>
  )
}

function AuxMeshPreview({ aux }: { aux: AuxMesh }): React.JSX.Element {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(aux.mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(aux.mesh.indices, 1))
    geo.setAttribute('normal', new THREE.BufferAttribute(aux.mesh.normals, 3))
    return geo
  }, [aux.mesh.positions, aux.mesh.indices, aux.mesh.normals])

  const color = aux.role === 'cutter' ? '#ef4444' : '#22c55e'

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <mesh position={[0, 10, 0]}>
      <boxGeometry args={[20, 20, 20]} />
      <meshStandardMaterial color="#2a2d3a" wireframe opacity={0.3} transparent />
    </mesh>
  )
}

export default function ReviewCanvas({
  bakedMesh,
  auxMeshes
}: ReviewCanvasProps): React.JSX.Element {
  return (
    <Canvas
      shadows
      camera={{ position: [60, 60, 100], fov: 50, near: 0.1, far: 1000 }}
      dpr={[1, 1.75]}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#0a0c12']} />
        <fog attach="fog" args={['#0a0c12', 180, 420]} />
        <ReviewScene bakedMesh={bakedMesh} auxMeshes={auxMeshes} />
      </Suspense>
    </Canvas>
  )
}
