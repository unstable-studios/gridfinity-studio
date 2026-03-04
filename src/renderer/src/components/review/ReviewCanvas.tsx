import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'

interface ReviewCanvasProps {
  bakedMesh?: { positions: Float32Array; indices: Uint32Array; normals: Float32Array } | null
}

function ReviewScene({ bakedMesh }: ReviewCanvasProps): React.JSX.Element {
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
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#4f9ef8" metalness={0.15} roughness={0.35} />
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

export default function ReviewCanvas({ bakedMesh }: ReviewCanvasProps): React.JSX.Element {
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
        <ReviewScene bakedMesh={bakedMesh} />
      </Suspense>
    </Canvas>
  )
}
