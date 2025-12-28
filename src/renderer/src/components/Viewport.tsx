import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'

type ViewportSize = {
  width: number
  height: number
}

function SceneContents(): React.JSX.Element {
  const cubeRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (cubeRef.current) {
      cubeRef.current.rotation.y = t * 0.35
      cubeRef.current.rotation.x = Math.sin(t * 0.25) * 0.35
    }
  })

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

      <Grid
        args={[30, 30]}
        sectionColor="#454c65"
        sectionThickness={0.6}
        cellColor="#2c3144"
        cellThickness={0.45}
        fadeDistance={18}
        fadeStrength={1}
        position={[0, 0.001, 0]}
        infiniteGrid
      />

      <axesHelper args={[2]} />

      <mesh ref={cubeRef} castShadow position={[0, 1.2, 0]}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial color="#4f9ef8" metalness={0.15} roughness={0.35} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0c0f17" roughness={1} />
      </mesh>
    </>
  )
}

export default function Viewport(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = (): void => {
      const { width, height } = element.getBoundingClientRect()
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }

    const observer = new ResizeObserver(() => updateSize())
    observer.observe(element)
    updateSize()

    return () => observer.disconnect()
  }, [])

  const isReady = size.width > 0 && size.height > 0

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-linear-to-b from-zinc-100/50 via-white to-zinc-100 shadow-inner dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-900 dark:to-zinc-900/70"
    >
      {isReady ? (
        <Canvas
          shadows
          camera={{ position: [6, 6, 10], fov: 50, near: 0.1, far: 100 }}
          dpr={[1, 1.75]}
          style={{ width: size.width, height: size.height }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <color attach="background" args={['#0a0c12']} />
            <fog attach="fog" args={['#0a0c12', 18, 42]} />
            <OrbitControls enableDamping makeDefault />
            <SceneContents />
          </Suspense>
        </Canvas>
      ) : (
        <div className="absolute inset-0 animate-pulse bg-zinc-200/60 dark:bg-zinc-800/60" />
      )}
    </div>
  )
}
