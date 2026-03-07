import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'
import { Z } from '@/lib/z-layers'

interface EntityRendererProps {
  entities: Entity[]
  selectedIds?: Set<string>
  collidingIds?: Set<string>
  hoveredId?: string | null
  onEntityClick?: (id: string, additive: boolean) => void
  onEntityHover?: (id: string | null) => void
  lightMode?: boolean
}

export default function EntityRenderer({
  entities,
  selectedIds,
  collidingIds,
  hoveredId,
  onEntityClick,
  onEntityHover,
  lightMode
}: EntityRendererProps): React.JSX.Element {
  return (
    <group>
      {entities
        .filter((e) => e.visible)
        .map((entity) => (
          <EntityShape
            key={entity.id}
            entity={entity}
            selected={selectedIds?.has(entity.id) ?? false}
            colliding={collidingIds?.has(entity.id) ?? false}
            hovered={hoveredId === entity.id}
            onClick={onEntityClick}
            onHover={onEntityHover}
            lightMode={lightMode}
          />
        ))}
    </group>
  )
}

function EntityShape({
  entity,
  selected,
  colliding,
  hovered,
  onClick,
  onHover,
  lightMode
}: {
  entity: Entity
  selected: boolean
  colliding: boolean
  hovered: boolean
  onClick?: (id: string, additive: boolean) => void
  onHover?: (id: string | null) => void
  lightMode?: boolean
}): React.JSX.Element | null {
  const defaultColor = lightMode ? '#475569' : '#94a3b8'
  const hoverColor = lightMode ? '#1e40af' : '#93c5fd'
  const color = colliding ? '#f87171' : selected ? '#60a5fa' : hovered ? hoverColor : defaultColor
  const { x, y } = entity.transform.position

  const handlePointerDown = (e: ThreeEvent<PointerEvent>): void => {
    if (e.nativeEvent.button !== 0) return
    e.stopPropagation()
    onClick?.(entity.id, e.nativeEvent.shiftKey || e.nativeEvent.metaKey || e.nativeEvent.ctrlKey)
  }

  const handlePointerOver = (): void => {
    onHover?.(entity.id)
  }

  const handlePointerOut = (): void => {
    onHover?.(null)
  }

  switch (entity.type) {
    case 'circle':
      return (
        <CircleOutline
          x={x}
          y={y}
          diameter={entity.diameter}
          color={color}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      )
    case 'rectangle':
      return (
        <RectangleOutline
          x={x}
          y={y}
          width={entity.width}
          height={entity.height}
          color={color}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      )
    case 'polygon':
      return (
        <PolygonOutline
          x={x}
          y={y}
          vertices={entity.vertices}
          color={color}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      )
    default:
      return null
  }
}

function LineShape({
  geometry,
  color,
  position,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  geometry: THREE.BufferGeometry
  color: string
  position: [number, number, number]
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}): React.JSX.Element {
  const lineObj = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color })
    return new THREE.Line(geometry, material)
  }, [geometry, color])

  return (
    <group onPointerDown={onPointerDown} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <primitive object={lineObj} position={position} />
      {/* Invisible hit area for click detection */}
      {onPointerDown && (
        <mesh position={position} visible={false}>
          <circleGeometry args={[3, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  )
}

function CircleOutline({
  x,
  y,
  diameter,
  color,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  x: number
  y: number
  diameter: number
  color: string
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}): React.JSX.Element {
  const geometry = useMemo(() => {
    const segments = 64
    const radius = diameter / 2
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [diameter])

  return (
    <LineShape
      geometry={geometry}
      color={color}
      position={[x, y, Z.ENTITY_OUTLINE]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
  )
}

function RectangleOutline({
  x,
  y,
  width,
  height,
  color,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  x: number
  y: number
  width: number
  height: number
  color: string
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}): React.JSX.Element {
  const geometry = useMemo(() => {
    const hw = width / 2
    const hh = height / 2
    const points = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0)
    ]
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [width, height])

  return (
    <LineShape
      geometry={geometry}
      color={color}
      position={[x, y, Z.ENTITY_OUTLINE]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
  )
}

function PolygonOutline({
  x,
  y,
  vertices,
  color,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  x: number
  y: number
  vertices: Array<{ x: number; y: number }>
  color: string
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}): React.JSX.Element | null {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null
    const points = [...vertices, vertices[0]].map((v) => new THREE.Vector3(v.x, v.y, 0))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [vertices])

  if (!geometry) return null

  return (
    <LineShape
      geometry={geometry}
      color={color}
      position={[x, y, Z.ENTITY_OUTLINE]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
  )
}
