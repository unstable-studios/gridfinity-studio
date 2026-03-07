import { useMemo, useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Entity } from '../../../../shared/types/project'
import { Z } from '@/lib/z-layers'

interface EntityInteractionManagerProps {
  entities: Entity[]
  onEntityClick?: (id: string, additive: boolean) => void
  onEntityHover?: (id: string | null) => void
}

/**
 * Renders invisible hit meshes matching each entity's shape.
 * Owns all entity pointer-event logic (click-to-select, hover).
 * EntityRenderer is the visual counterpart — it has zero pointer handlers.
 */
export default function EntityInteractionManager({
  entities,
  onEntityClick,
  onEntityHover
}: EntityInteractionManagerProps): React.JSX.Element {
  return (
    <group>
      {entities
        .filter((e) => e.visible)
        .map((entity) => (
          <EntityHitArea
            key={entity.id}
            entity={entity}
            onClick={onEntityClick}
            onHover={onEntityHover}
          />
        ))}
    </group>
  )
}

function EntityHitArea({
  entity,
  onClick,
  onHover
}: {
  entity: Entity
  onClick?: (id: string, additive: boolean) => void
  onHover?: (id: string | null) => void
}): React.JSX.Element | null {
  const { x, y } = entity.transform.position

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>): void => {
      if (e.nativeEvent.button !== 0) return
      e.stopPropagation()
      onClick?.(entity.id, e.nativeEvent.shiftKey || e.nativeEvent.metaKey || e.nativeEvent.ctrlKey)
    },
    [entity.id, onClick]
  )

  const handlePointerOver = useCallback((): void => {
    onHover?.(entity.id)
  }, [entity.id, onHover])

  const handlePointerOut = useCallback((): void => {
    onHover?.(null)
  }, [onHover])

  switch (entity.type) {
    case 'circle':
      return (
        <mesh
          position={[x, y, Z.ENTITY_FILL]}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <circleGeometry args={[entity.diameter / 2, 64]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )
    case 'rectangle':
      return (
        <mesh
          position={[x, y, Z.ENTITY_FILL]}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <planeGeometry args={[entity.width, entity.height]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )
    case 'polygon':
      return (
        <PolygonHitArea
          x={x}
          y={y}
          vertices={entity.vertices}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      )
    default:
      return null
  }
}

function PolygonHitArea({
  x,
  y,
  vertices,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  x: number
  y: number
  vertices: Array<{ x: number; y: number }>
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver: () => void
  onPointerOut: () => void
}): React.JSX.Element | null {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null
    const shape = new THREE.Shape(vertices.map((v) => new THREE.Vector2(v.x, v.y)))
    return new THREE.ShapeGeometry(shape)
  }, [vertices])

  if (!geometry) return null

  return (
    <mesh
      position={[x, y, Z.ENTITY_FILL]}
      geometry={geometry}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
