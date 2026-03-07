import { useMemo } from 'react'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'
import { Z } from '@/lib/z-layers'

interface EntityRendererProps {
  entities: Entity[]
  selectedIds?: Set<string>
  collidingIds?: Set<string>
  hoveredId?: string | null
  lightMode?: boolean
}

/**
 * Pure visual renderer for entities — outlines and fills.
 * Contains zero pointer-event logic; see EntityInteractionManager for that.
 */
export default function EntityRenderer({
  entities,
  selectedIds,
  collidingIds,
  hoveredId,
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
  lightMode
}: {
  entity: Entity
  selected: boolean
  colliding: boolean
  hovered: boolean
  lightMode?: boolean
}): React.JSX.Element | null {
  const defaultColor = lightMode ? '#475569' : '#94a3b8'
  const hoverColor = lightMode ? '#1e40af' : '#93c5fd'
  const color = colliding ? '#f87171' : selected ? '#60a5fa' : hovered ? hoverColor : defaultColor
  const { x, y } = entity.transform.position
  const fillOpacity = selected ? 0.08 : hovered ? 0.05 : 0.025

  switch (entity.type) {
    case 'circle':
      return (
        <CircleOutline
          x={x}
          y={y}
          diameter={entity.diameter}
          color={color}
          fillOpacity={fillOpacity}
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
          fillOpacity={fillOpacity}
        />
      )
    case 'polygon':
      return (
        <PolygonOutline
          x={x}
          y={y}
          vertices={entity.vertices}
          color={color}
          fillOpacity={fillOpacity}
        />
      )
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
  color,
  fillOpacity
}: {
  x: number
  y: number
  diameter: number
  color: string
  fillOpacity: number
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
    <group>
      <LineShape geometry={geometry} color={color} position={[x, y, Z.ENTITY_OUTLINE]} />
      <mesh position={[x, y, Z.ENTITY_FILL]}>
        <circleGeometry args={[diameter / 2, 64]} />
        <meshBasicMaterial color={color} transparent opacity={fillOpacity} />
      </mesh>
    </group>
  )
}

function RectangleOutline({
  x,
  y,
  width,
  height,
  color,
  fillOpacity
}: {
  x: number
  y: number
  width: number
  height: number
  color: string
  fillOpacity: number
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
    <group>
      <LineShape geometry={geometry} color={color} position={[x, y, Z.ENTITY_OUTLINE]} />
      <mesh position={[x, y, Z.ENTITY_FILL]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} transparent opacity={fillOpacity} />
      </mesh>
    </group>
  )
}

function PolygonOutline({
  x,
  y,
  vertices,
  color,
  fillOpacity
}: {
  x: number
  y: number
  vertices: Array<{ x: number; y: number }>
  color: string
  fillOpacity: number
}): React.JSX.Element | null {
  const outlineGeometry = useMemo(() => {
    if (vertices.length < 3) return null
    const points = [...vertices, vertices[0]].map((v) => new THREE.Vector3(v.x, v.y, 0))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [vertices])

  const fillGeometry = useMemo(() => {
    if (vertices.length < 3) return null
    const shape = new THREE.Shape(vertices.map((v) => new THREE.Vector2(v.x, v.y)))
    return new THREE.ShapeGeometry(shape)
  }, [vertices])

  if (!outlineGeometry) return null

  return (
    <group>
      <LineShape geometry={outlineGeometry} color={color} position={[x, y, Z.ENTITY_OUTLINE]} />
      {fillGeometry && (
        <mesh position={[x, y, Z.ENTITY_FILL]} geometry={fillGeometry}>
          <meshBasicMaterial color={color} transparent opacity={fillOpacity} />
        </mesh>
      )}
    </group>
  )
}
