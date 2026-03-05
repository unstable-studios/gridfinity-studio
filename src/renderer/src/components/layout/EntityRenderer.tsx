import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'

interface EntityRendererProps {
  entities: Entity[]
  selectedIds?: Set<string>
  onEntityClick?: (id: string, shiftKey: boolean) => void
}

export default function EntityRenderer({
  entities,
  selectedIds,
  onEntityClick
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
            onClick={onEntityClick}
          />
        ))}
    </group>
  )
}

function EntityShape({
  entity,
  selected,
  onClick
}: {
  entity: Entity
  selected: boolean
  onClick?: (id: string, shiftKey: boolean) => void
}): React.JSX.Element | null {
  const color = selected ? '#60a5fa' : '#94a3b8'
  const { x, y } = entity.transform.position

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    onClick?.(entity.id, e.nativeEvent.shiftKey)
  }

  switch (entity.type) {
    case 'circle':
      return (
        <CircleOutline x={x} y={y} diameter={entity.diameter} color={color} onClick={handleClick} />
      )
    case 'rectangle':
      return (
        <RectangleOutline
          x={x}
          y={y}
          width={entity.width}
          height={entity.height}
          color={color}
          onClick={handleClick}
        />
      )
    case 'polygon':
      return (
        <PolygonOutline
          x={x}
          y={y}
          vertices={entity.vertices}
          color={color}
          onClick={handleClick}
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
  onClick
}: {
  geometry: THREE.BufferGeometry
  color: string
  position: [number, number, number]
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}): React.JSX.Element {
  const lineObj = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color })
    return new THREE.Line(geometry, material)
  }, [geometry, color])

  return (
    <group onClick={onClick}>
      <primitive object={lineObj} position={position} />
      {/* Invisible hit area for click detection */}
      {onClick && (
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
  onClick
}: {
  x: number
  y: number
  diameter: number
  color: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
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

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} onClick={onClick} />
}

function RectangleOutline({
  x,
  y,
  width,
  height,
  color,
  onClick
}: {
  x: number
  y: number
  width: number
  height: number
  color: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
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

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} onClick={onClick} />
}

function PolygonOutline({
  x,
  y,
  vertices,
  color,
  onClick
}: {
  x: number
  y: number
  vertices: Array<{ x: number; y: number }>
  color: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}): React.JSX.Element | null {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null
    const points = [...vertices, vertices[0]].map((v) => new THREE.Vector3(v.x, v.y, 0))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [vertices])

  if (!geometry) return null

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} onClick={onClick} />
}
