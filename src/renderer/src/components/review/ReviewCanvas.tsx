import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useReviewPrefs } from '@/hooks/useReviewPrefs'
import { useTheme } from '@unstable-studios/ui'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const THEME_COLORS = {
  dark: { bg: '#0a0c12', floor: '#0c0f17', fog: '#0a0c12' },
  light: { bg: '#e8eaed', floor: '#d4d7dd', fog: '#e8eaed' }
} as const

const CAMERA_KEY = 'gfstudio:reviewCamera'

interface BakedMeshData {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

interface ReviewCanvasProps {
  bakedMesh?: BakedMeshData | null
}

interface SceneProps {
  bakedMesh?: BakedMeshData | null
  debugColors: boolean
  wireframe: boolean
  colors: { bg: string; floor: string; fog: string }
}

function ReviewScene({ bakedMesh, debugColors, wireframe, colors }: SceneProps): React.JSX.Element {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const saveCamera = (): void => {
    if (!controlsRef.current) return
    const cam = controlsRef.current.object
    const target = controlsRef.current.target
    sessionStorage.setItem(
      CAMERA_KEY,
      JSON.stringify({
        pos: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z]
      })
    )
  }

  // Restore orbit target after controls mount
  useEffect(() => {
    const raw = sessionStorage.getItem(CAMERA_KEY)
    if (!raw || !controlsRef.current) return
    try {
      const saved = JSON.parse(raw) as {
        pos: [number, number, number]
        target: [number, number, number]
      }
      controlsRef.current.object.position.set(...saved.pos)
      controlsRef.current.target.set(...saved.target)
      controlsRef.current.update()
      console.log('[ReviewCanvas] camera restored from session')
    } catch {
      console.warn('[ReviewCanvas] failed to restore camera state')
    }
  }, [])

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
      <OrbitControls
        ref={controlsRef}
        enableDamping
        makeDefault
        onEnd={saveCamera}
        minDistance={5}
        maxDistance={500}
        maxPolarAngle={Math.PI * 0.85}
      />

      {bakedMesh ? (
        <BakedMeshPreview mesh={bakedMesh} debugColors={debugColors} wireframe={wireframe} />
      ) : (
        <EmptyState />
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={colors.floor} roughness={1} />
      </mesh>
    </>
  )
}

function BakedMeshPreview({
  mesh,
  debugColors,
  wireframe
}: {
  mesh: BakedMeshData
  debugColors: boolean
  wireframe: boolean
}): React.JSX.Element {
  const hasColors = mesh.colors && mesh.colors.length > 0
  const useColors = hasColors && debugColors

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
    if (hasColors) {
      geo.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3))
    }
    return geo
  }, [mesh.positions, mesh.indices, mesh.normals, mesh.colors, hasColors])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          key={useColors ? 'vc' : 'solid'}
          vertexColors={useColors}
          color={useColors ? undefined : '#4f9ef8'}
          metalness={0.15}
          roughness={0.35}
          side={THREE.FrontSide}
        />
      </mesh>
      {wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial wireframe color="#000000" opacity={0.08} transparent depthTest />
        </mesh>
      )}
    </group>
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
  const { debugColors, wireframe } = useReviewPrefs()
  const { resolvedTheme } = useTheme()
  const colors = THEME_COLORS[resolvedTheme === 'light' ? 'light' : 'dark']

  return (
    <Canvas
      shadows
      camera={{ position: [60, 60, 100], fov: 50, near: 0.1, far: 2000 }}
      dpr={[1, 1.75]}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={[colors.bg]} />
        <fog attach="fog" args={[colors.fog, 500, 900]} />
        <ReviewScene
          bakedMesh={bakedMesh}
          debugColors={debugColors}
          wireframe={wireframe}
          colors={colors}
        />
      </Suspense>
    </Canvas>
  )
}
