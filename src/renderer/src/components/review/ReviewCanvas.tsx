import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import type { AuxMesh } from '@/hooks/useProject'

interface BakedMeshData {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

interface ReviewCanvasProps {
  bakedMesh?: BakedMeshData | null
  auxMeshes?: AuxMesh[]
}

function ReviewScene({ bakedMesh, auxMeshes }: ReviewCanvasProps): React.JSX.Element {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <directionalLight position={[-4, 8, -4]} intensity={0.6} />
      <directionalLight position={[0, -8, 0]} intensity={0.5} />
      <pointLight position={[-6, -4, -6]} intensity={0.6} />
      <pointLight position={[6, 2, -6]} intensity={0.4} />
      <pointLight position={[0, -6, 4]} intensity={0.4} />
      <OrbitControls enableDamping makeDefault />

      {bakedMesh ? <BakedMeshPreview mesh={bakedMesh} /> : <EmptyState />}

      {auxMeshes?.map((aux) => (
        <AuxMeshPreview key={aux.entityId} aux={aux} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0c0f17" roughness={1} />
      </mesh>
    </>
  )
}

function BakedMeshPreview({ mesh }: { mesh: BakedMeshData }): React.JSX.Element {
  const hasColors = mesh.colors && mesh.colors.length > 0

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    // Let Three.js compute correct normals from triangle winding
    geo.computeVertexNormals()
    if (hasColors) {
      geo.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3))
    }
    return geo
  }, [mesh.positions, mesh.indices, mesh.colors, hasColors])

  return (
    <mesh geometry={geometry} castShadow rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        vertexColors={hasColors}
        color={hasColors ? undefined : '#4f9ef8'}
        metalness={0.15}
        roughness={0.35}
        side={THREE.DoubleSide}
      />
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
    <mesh geometry={geometry} castShadow rotation={[-Math.PI / 2, 0, 0]}>
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
        <fog attach="fog" args={['#0a0c12', 500, 900]} />
        <ReviewScene bakedMesh={bakedMesh} auxMeshes={auxMeshes} />
      </Suspense>
    </Canvas>
  )
}
