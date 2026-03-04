import { useMemo } from 'react'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'

interface EntityRendererProps {
  entities: Entity[]
  selectedIds?: Set<string>
}

export default function EntityRenderer({
  entities,
  selectedIds
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
          />
        ))}
    </group>
  )
}

function EntityShape({
  entity,
  selected
}: {
  entity: Entity
  selected: boolean
}): React.JSX.Element | null {
  const color = selected ? '#60a5fa' : '#94a3b8'
  const { x, y } = entity.transform.position

  switch (entity.type) {
    case 'circle':
      return <CircleOutline x={x} y={y} diameter={entity.diameter} color={color} />
    case 'rectangle':
      return (
        <RectangleOutline x={x} y={y} width={entity.width} height={entity.height} color={color} />
      )
    case 'polygon':
      return <PolygonOutline x={x} y={y} vertices={entity.vertices} color={color} />
    default:
      return null
  }
}

function LineShape({
  geometry,
  color,
  position
}: {
  geometry: THREE.BufferGeometry
  color: string
  position: [number, number, number]
}): React.JSX.Element {
  const lineObj = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color })
    return new THREE.Line(geometry, material)
  }, [geometry, color])

  return <primitive object={lineObj} position={position} />
}

function CircleOutline({
  x,
  y,
  diameter,
  color
}: {
  x: number
  y: number
  diameter: number
  color: string
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

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} />
}

function RectangleOutline({
  x,
  y,
  width,
  height,
  color
}: {
  x: number
  y: number
  width: number
  height: number
  color: string
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

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} />
}

function PolygonOutline({
  x,
  y,
  vertices,
  color
}: {
  x: number
  y: number
  vertices: Array<{ x: number; y: number }>
  color: string
}): React.JSX.Element | null {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null
    const points = [...vertices, vertices[0]].map((v) => new THREE.Vector3(v.x, v.y, 0))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [vertices])

  if (!geometry) return null

  return <LineShape geometry={geometry} color={color} position={[x, y, 0.01]} />
}
