/**
 * The example projects listed on the welcome screen. Each is built in code, in the form a
 * saved project has, and opens as a new unsaved project.
 */
import { createEmptyProject } from '../../../shared/types/project'
import type { LayoutGroupData, LayoutShapeData, ProjectData } from '../../../shared/types/project'

export interface ExampleProject {
  id: string
  name: string
  /** One line saying what the example shows. */
  description: string
  build: () => ProjectData
}

// The looks the app gives a bin and a shape when they are drawn.
const BIN_STYLE = {
  fill: 'rgba(96, 165, 250, 0.05)',
  stroke: '#60a5fa',
  strokeWidth: 1,
  cornerRadius: 4
}
const SHAPE_STYLE = {
  rotation: 0,
  fill: 'rgba(168, 85, 247, 0.12)',
  stroke: '#a855f7',
  strokeWidth: 1
}
const POCKET = { clearance: 0.25 }

/** A pocket, placed from the middle of its bin. X grows to the right and Y grows downward. */
type Pocket = { name: string; x: number; y: number } & (
  | { type: 'rect'; width: number; height: number }
  | { type: 'circle'; diameter: number }
  | { type: 'polygon'; points: Array<{ x: number; y: number }> }
)

interface Bin {
  name: string
  /** Lower-left corner, in grid units from the origin. */
  column: number
  row: number
  widthUnits: number
  depthUnits: number
  heightUnits: number
  pockets: Pocket[]
}

function project(id: string, name: string, description: string, bins: Bin[]): ProjectData {
  const data = createEmptyProject(name)
  data.settings.description = description
  const unit = data.gridfinity.baseUnit
  const groups: LayoutGroupData[] = []
  const shapes: LayoutShapeData[] = []

  bins.forEach((bin, binIndex) => {
    const binId = `${id}-bin-${binIndex + 1}`
    const childIds: string[] = []
    bin.pockets.forEach((pocket, pocketIndex) => {
      const shapeId = `${binId}-shape-${pocketIndex + 1}`
      childIds.push(shapeId)
      const common = {
        id: shapeId,
        x: pocket.x,
        y: pocket.y,
        ...SHAPE_STYLE,
        groupId: binId,
        metadata: { name: pocket.name, pocket: { ...POCKET } }
      }
      if (pocket.type === 'rect') {
        shapes.push({ ...common, type: 'rect', width: pocket.width, height: pocket.height })
      } else if (pocket.type === 'circle') {
        const radius = pocket.diameter / 2
        shapes.push({ ...common, type: 'circle', radiusX: radius, radiusY: radius })
      } else {
        shapes.push({ ...common, type: 'polygon', points: pocket.points.map((p) => ({ ...p })) })
      }
    })
    groups.push({
      id: binId,
      x: bin.column * unit,
      y: bin.row * unit,
      width: bin.widthUnits * unit,
      height: bin.depthUnits * unit,
      rotation: 0,
      childIds,
      style: { ...BIN_STYLE },
      metadata: {
        name: bin.name,
        widthUnits: bin.widthUnits,
        depthUnits: bin.depthUnits,
        heightUnits: bin.heightUnits,
        hasLip: true
      }
    })
  })

  data.layoutSnapshot.groups = groups
  data.layoutSnapshot.shapes = shapes
  return data
}

/** A row of round pockets, spaced evenly and centered on the bin. */
function socketRow(label: string, diameters: number[], pitch: number, y: number): Pocket[] {
  const start = (-(diameters.length - 1) * pitch) / 2
  return diameters.map((diameter, i) => ({
    type: 'circle',
    name: `${label} ${diameter} mm`,
    diameter,
    x: start + i * pitch,
    y
  }))
}

function socketTray(): Bin[] {
  return [
    {
      name: 'Sockets',
      column: 0,
      row: 0,
      widthUnits: 4,
      depthUnits: 2,
      heightUnits: 3,
      pockets: [
        ...socketRow('Small', [12, 12, 12, 12, 12, 12, 12, 12], 18, -19),
        ...socketRow('Large', [17, 18, 19, 20, 22, 24], 26, 17)
      ]
    }
  ]
}

function dividedTray(): Bin[] {
  const columns = [-39, 0, 39]
  const rows = [-18.5, 18.5]
  const pockets: Pocket[] = rows.flatMap((y, row) =>
    columns.map((x, column) => ({
      type: 'rect' as const,
      name: `Compartment ${row * columns.length + column + 1}`,
      width: 36,
      height: 34,
      x,
      y
    }))
  )
  return [
    {
      name: 'Small parts',
      column: 0,
      row: 0,
      widthUnits: 3,
      depthUnits: 2,
      heightUnits: 3,
      pockets
    }
  ]
}

function toolTray(): Bin[] {
  return [
    {
      name: 'Tools',
      column: 0,
      row: 0,
      widthUnits: 3,
      depthUnits: 2,
      heightUnits: 3,
      pockets: [
        {
          type: 'polygon',
          name: 'Knife',
          x: 0,
          y: -20,
          points: [
            { x: -50, y: -10 },
            { x: 15, y: -13 },
            { x: 50, y: -5 },
            { x: 50, y: 9 },
            { x: -50, y: 13 }
          ]
        },
        { type: 'circle', name: 'Tape', diameter: 30, x: -38, y: 20 },
        { type: 'rect', name: 'Bits', width: 60, height: 24, x: 22, y: 20 }
      ]
    },
    {
      name: 'Spares',
      // One grid unit clear of the first bin.
      column: 4,
      row: 0,
      widthUnits: 1,
      depthUnits: 2,
      heightUnits: 3,
      pockets: [
        { type: 'rect', name: 'Blades', width: 30, height: 30, x: 0, y: -19 },
        { type: 'rect', name: 'Screws', width: 30, height: 30, x: 0, y: 19 }
      ]
    }
  ]
}

function example(id: string, name: string, description: string, bins: () => Bin[]): ExampleProject {
  return { id, name, description, build: () => project(id, name, description, bins()) }
}

export const EXAMPLE_PROJECTS: ExampleProject[] = [
  example('socket-tray', 'Socket tray', 'Round pockets in two rows', socketTray),
  example('divided-tray', 'Divided tray', 'Six compartments for small parts', dividedTray),
  example('tool-tray', 'Tool tray', 'Two bins with mixed shapes', toolTray)
]
