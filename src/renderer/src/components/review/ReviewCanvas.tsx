import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useCursor } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useReviewPrefs } from '@/hooks/useReviewPrefs'
import { useTheme } from '@unstable-studios/ui'
import { resolveColors, type CanvasThemeColors } from '@/lib/theme-config'
import type { BakeResult } from '@/hooks/useProject'
import { useLayoutEngine, useLayoutEngineContext, useEngineState } from '@/layout-engine'
import { useExport, useExportMenuOpen } from '@/hooks/useExport'
import { boundsKey, frameBounds } from '@/lib/camera-framing'
import type { Bounds3 } from '@/lib/camera-framing'
import { LEFT_OUT_OPACITY, glowIntensity, isClick, leftOutColor } from '@/lib/preview-pick'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const CAMERA_KEY = 'gfstudio:reviewCamera'

interface BakedMeshData {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
  normals: Float32Array
}

interface BinPlacement {
  id: string
  mesh: BakedMeshData
  /** Bin centroid in the scene (x, 0, z). */
  position: [number, number, number]
  width: number
  depth: number
}

interface SavedCamera {
  /** Layout the camera was saved for; see `boundsKey`. */
  layoutKey: string | null
  pos: [number, number, number]
  target: [number, number, number]
}

const MAX_CAMERA_DISTANCE = 2000
// Beyond the furthest orbit plus the floor, so zooming out never clips.
const CAMERA_FAR = 10000
const FLOOR_SIZE = 4000
const FOG_NEAR = 500

function readSavedCamera(): SavedCamera | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_KEY)
    return raw ? (JSON.parse(raw) as SavedCamera) : null
  } catch {
    return null
  }
}

const meshHeights = new WeakMap<Float32Array, number>()

/**
 * Height of a baked mesh. Meshes are built z-up and rotated onto the floor,
 * so mesh z is height. Cached per vertex buffer: bounds are recomputed on
 * every engine change, and a bake result's buffer never changes.
 */
function meshHeight(positions: Float32Array): number {
  let height = meshHeights.get(positions)
  if (height === undefined) {
    height = 0
    for (let i = 2; i < positions.length; i += 3) {
      if (positions[i] > height) height = positions[i]
    }
    meshHeights.set(positions, height)
  }
  return height
}

/** Bounding box of every placed bin, in scene coordinates. */
function sceneBounds(placements: BinPlacement[]): Bounds3 | null {
  if (placements.length === 0) return null
  const min: [number, number, number] = [Infinity, 0, Infinity]
  const max: [number, number, number] = [-Infinity, 0, -Infinity]
  for (const { mesh, position, width, depth } of placements) {
    min[0] = Math.min(min[0], position[0] - width / 2)
    max[0] = Math.max(max[0], position[0] + width / 2)
    min[2] = Math.min(min[2], position[2] - depth / 2)
    max[2] = Math.max(max[2], position[2] + depth / 2)
    max[1] = Math.max(max[1], meshHeight(mesh.positions))
  }
  return { min, max }
}

interface ReviewCanvasProps {
  bakeResults: Map<string, BakeResult>
  baseUnit: number
}

/** Which bins are left out of the export, and how a click changes that. */
interface ExportChoice {
  /** Bins unchecked for export. */
  leftOut: ReadonlySet<string>
  /** Check or uncheck a bin. Absent when there is nothing to choose: one bin. */
  onPick?: (binId: string) => void
}

interface SceneProps extends ExportChoice {
  bakeResults: Map<string, BakeResult>
  baseUnit: number
  debugColors: boolean
  wireframe: boolean
  colors: CanvasThemeColors
}

function ReviewScene({
  bakeResults,
  debugColors,
  wireframe,
  colors,
  leftOut,
  onPick
}: SceneProps): React.JSX.Element {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const engine = useLayoutEngine()
  const { sidebarRef } = useLayoutEngineContext()
  const { tick } = useEngineState()
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const gl = useThree((state) => state.gl)

  // Each bin's mesh is centered on its own origin; place it at the bin's
  // layout position so the 3D scene mirrors the 2D layout. Group positions
  // are re-read from the engine (gated on `tick`) so a bin moved in Design
  // shows in its new place on the next switch to Preview.
  const placements = useMemo(() => {
    const out: BinPlacement[] = []
    for (const [binId, result] of bakeResults) {
      const group = engine?.getGroup(binId)
      if (!group) continue
      // Editor lower-left (x, y) → centroid (x + w/2, y - h/2). Editor +y is
      // screen-down; mapping it to +z keeps the arrangement (down in 2D =
      // toward the viewer in 3D).
      out.push({
        id: binId,
        mesh: result.mesh,
        position: [group.x + group.width / 2, 0, group.y - group.height / 2],
        width: group.width,
        depth: group.height
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bakeResults, engine, tick])

  const bounds = useMemo(() => sceneBounds(placements), [placements])
  const layoutKey = bounds ? boundsKey(bounds) : null
  // The layout the camera was last framed or restored for.
  const framedKeyRef = useRef<string | null>(null)

  const saveCamera = (): void => {
    if (!controlsRef.current) return
    const cam = controlsRef.current.object
    const target = controlsRef.current.target
    sessionStorage.setItem(
      CAMERA_KEY,
      JSON.stringify({
        layoutKey: framedKeyRef.current,
        pos: [cam.position.x, cam.position.y, cam.position.z],
        target: [target.x, target.y, target.z]
      } satisfies SavedCamera)
    )
  }

  // Shift the projection so the scene centers in the area the sidebar does
  // not cover, instead of the middle of the whole canvas.
  // Width of the canvas the sidebar covers. Kept in state for the view
  // offset, and measured directly where an effect needs it before the state
  // has caught up (the first framing).
  const measureSidebarInset = useCallback((): number => {
    const sidebar = sidebarRef.current
    if (!sidebar) return 0
    return Math.max(
      0,
      sidebar.getBoundingClientRect().right - gl.domElement.getBoundingClientRect().left
    )
  }, [sidebarRef, gl])
  const [sidebarInset, setSidebarInset] = useState(0)
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return
    const measure = (): void => setSidebarInset(measureSidebarInset())
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(sidebar)
    return () => observer.disconnect()
  }, [sidebarRef, measureSidebarInset, size.width, size.height])

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.width === 0) return
    camera.setViewOffset(size.width, size.height, -sidebarInset / 2, 0, size.width, size.height)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, sidebarInset])

  // Frame the bins whenever the layout changes. A camera the person orbited
  // to is kept for as long as the layout it was saved for is unchanged.
  useEffect(() => {
    const controls = controlsRef.current
    if (!bounds || !layoutKey || !controls || size.width === 0) return
    if (framedKeyRef.current === layoutKey) return
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    framedKeyRef.current = layoutKey

    const saved = readSavedCamera()
    if (saved && saved.layoutKey === layoutKey) {
      camera.position.set(...saved.pos)
      controls.target.set(...saved.target)
    } else {
      const visibleAspect = Math.max(size.width - measureSidebarInset(), 1) / size.height
      const frame = frameBounds(bounds, camera.fov, visibleAspect)
      camera.position.set(...frame.position)
      controls.target.set(...frame.target)
    }
    controls.update()
  }, [bounds, layoutKey, camera, size.width, size.height, measureSidebarInset])

  // Fog fades the floor into the background. Keep it well behind the model
  // so a large layout, framed from further away, is not fogged itself.
  const fogNear = bounds ? Math.max(FOG_NEAR, frameBounds(bounds, 50, 1).distance * 2) : FOG_NEAR

  const floorCenter = bounds
    ? ([(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2] as const)
    : ([0, 0] as const)

  return (
    <>
      <fog attach="fog" args={[colors.reviewFog, fogNear, fogNear * 1.8]} />
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
        maxDistance={MAX_CAMERA_DISTANCE}
        maxPolarAngle={Math.PI * 0.85}
      />

      {bakeResults.size > 0 ? (
        <BakedBins
          placements={placements}
          debugColors={debugColors}
          wireframe={wireframe}
          meshColor={colors.meshColor}
          leftOutMeshColor={leftOutColor(colors.meshColor)}
          leftOut={leftOut}
          onPick={onPick}
        />
      ) : (
        <EmptyState color={colors.emptyState} />
      )}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[floorCenter[0], -0.1, floorCenter[1]]}
        receiveShadow
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial color={colors.reviewFloor} roughness={1} />
      </mesh>
    </>
  )
}

function BakedBins({
  placements,
  debugColors,
  wireframe,
  meshColor,
  leftOutMeshColor,
  leftOut,
  onPick
}: ExportChoice & {
  placements: BinPlacement[]
  debugColors: boolean
  wireframe: boolean
  meshColor: string
  leftOutMeshColor: string
}): React.JSX.Element {
  return (
    <>
      {placements.map(({ id, mesh, position }) => (
        <BakedMeshPreview
          key={id}
          mesh={mesh}
          // A bin left out of the export is drawn gray and see-through, in one flat color.
          debugColors={debugColors && !leftOut.has(id)}
          wireframe={wireframe}
          meshColor={leftOut.has(id) ? leftOutMeshColor : meshColor}
          glowColor={meshColor}
          checked={!leftOut.has(id)}
          position={position}
          onPick={onPick && (() => onPick(id))}
        />
      ))}
    </>
  )
}

function BakedMeshPreview({
  mesh,
  debugColors,
  wireframe,
  meshColor,
  glowColor,
  checked,
  position,
  onPick
}: {
  mesh: BakedMeshData
  debugColors: boolean
  wireframe: boolean
  meshColor: string
  /** The color the bin glows in: see `glowIntensity`. */
  glowColor: string
  /** Whether the bin is checked for export. One that is not is drawn see-through. */
  checked: boolean
  position?: [number, number, number]
  /** Called when the bin is clicked. Without it the bin cannot be clicked. */
  onPick?: () => void
}): React.JSX.Element {
  const hasColors = mesh.colors && mesh.colors.length > 0
  const useColors = hasColors && debugColors
  const [hovered, setHovered] = useState(false)
  // A pointing hand over a bin that can be clicked. It goes back when the bin goes.
  useCursor(hovered && onPick !== undefined)

  // See-through bins are drawn one whole bin at a time, the furthest first, so a nearer one
  // is blended over the ones behind it. Each bin's three passes take their place in that
  // order from how far the bin is from the camera, measured again on every frame.
  const depthPass = useRef<THREE.Mesh>(null)
  const surface = useRef<THREE.Mesh>(null)
  const wires = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => {
    const [x, y, z] = position ?? [0, 0, 0]
    const order = checked
      ? 0
      : -Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z)
    if (depthPass.current) depthPass.current.renderOrder = order
    if (surface.current) surface.current.renderOrder = checked ? 0 : order + 0.25
    if (wires.current) wires.current.renderOrder = checked ? 0 : order + 0.5
  })

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
    <group
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      onClick={
        onPick &&
        ((event) => {
          // Only the nearest bin under the pointer takes the click. Without this the click
          // would reach every bin behind it too.
          event.stopPropagation()
          // `delta` is how far the pointer moved while pressed: further is an orbit.
          if (isClick(event.delta)) onPick()
        })
      }
      onPointerOver={
        onPick &&
        ((event) => {
          event.stopPropagation()
          setHovered(true)
        })
      }
      onPointerOut={onPick && (() => setHovered(false))}
    >
      {!checked && (
        // A see-through bin shows only its own nearest surface: this draws no color, only
        // depth, so the walls and pockets behind that surface are not blended in over each
        // other. It is drawn with the see-through things, after everything solid, or it
        // would hide the floor and the solid bins behind this one.
        <mesh ref={depthPass} geometry={geometry} raycast={() => null}>
          <meshBasicMaterial colorWrite={false} transparent />
        </mesh>
      )}
      <mesh ref={surface} geometry={geometry} castShadow={checked}>
        <meshStandardMaterial
          key={`${useColors ? 'vc' : 'solid'}-${checked ? 'opaque' : 'see-through'}`}
          vertexColors={useColors}
          color={useColors ? undefined : meshColor}
          transparent={!checked}
          opacity={checked ? 1 : LEFT_OUT_OPACITY}
          emissive={glowColor}
          // Debug colors are there to be read as they are, so nothing is added over them.
          emissiveIntensity={
            useColors ? 0 : glowIntensity({ checked, hovered: hovered && onPick !== undefined })
          }
          metalness={0.15}
          roughness={0.35}
          side={THREE.FrontSide}
        />
      </mesh>
      {wireframe && (
        // The solid mesh above answers the pointer; the overlay would only repeat its hits.
        <mesh ref={wires} geometry={geometry} raycast={() => null}>
          <meshBasicMaterial wireframe color="#000000" opacity={0.08} transparent depthTest />
        </mesh>
      )}
    </group>
  )
}

function EmptyState({ color }: { color: string }): React.JSX.Element {
  return (
    <mesh position={[0, 10, 0]}>
      <boxGeometry args={[20, 20, 20]} />
      <meshStandardMaterial color={color} wireframe opacity={0.3} transparent />
    </mesh>
  )
}

export default function ReviewCanvas({
  bakeResults,
  baseUnit
}: ReviewCanvasProps): React.JSX.Element {
  const { debugColors, wireframe } = useReviewPrefs()
  const { resolvedTheme } = useTheme()
  const colors = resolveColors(resolvedTheme)
  const { bins, chosen, setChecked } = useExport()

  const leftOut = useMemo(() => {
    const checked = new Set(chosen.map((bin) => bin.id))
    return new Set(bins.filter((bin) => !checked.has(bin.id)).map((bin) => bin.id))
  }, [bins, chosen])
  // A press that closes the Export popover is only that: it does not also pick the bin under it.
  const [exportMenuOpen] = useExportMenuOpen()
  const pressedWithMenuOpen = useRef(false)
  // With one bin there is nothing to choose, as in the sidebar, which shows no checkbox.
  const onPick =
    bins.length > 1
      ? (binId: string): void => {
          if (!pressedWithMenuOpen.current) setChecked(binId, leftOut.has(binId))
        }
      : undefined

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      // Capture, so this runs before the popover closes on the same press.
      onPointerDownCapture={() => {
        pressedWithMenuOpen.current = exportMenuOpen
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [60, 60, 100], fov: 50, near: 0.1, far: CAMERA_FAR }}
        dpr={[1, 1.75]}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={[colors.reviewBg]} />
          <ReviewScene
            bakeResults={bakeResults}
            baseUnit={baseUnit}
            debugColors={debugColors}
            wireframe={wireframe}
            colors={colors}
            leftOut={leftOut}
            onPick={onPick}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
