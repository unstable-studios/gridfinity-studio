interface SelectionBoxProps {
  start: { x: number; y: number } | null
  end: { x: number; y: number } | null
  visible: boolean
}

export default function SelectionBox({
  start,
  end,
  visible
}: SelectionBoxProps): React.JSX.Element | null {
  if (!visible || !start || !end) return null

  const cx = (start.x + end.x) / 2
  const cy = (start.y + end.y) / 2
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  if (width === 0 && height === 0) return null

  return (
    <mesh position={[cx, cy, 0.03]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} depthWrite={false} />
    </mesh>
  )
}
