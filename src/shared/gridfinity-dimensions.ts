/**
 * Dimensions from the Gridfinity specification, in mm. The 3D builder and the default
 * pocket depth both read them from here.
 */

/** A step of a profile: how far in from the outer wall, and how high. */
export type ProfileStep = readonly [inset: number, height: number]

/**
 * The foot under each grid square, from its bottom up. The foot is narrowest at the bottom
 * and reaches the full width of the square at the top.
 */
export const BASE_PROFILE: ReadonlyArray<ProfileStep> = [
  [0, 0],
  [0.8, 0.8], // 45° chamfer
  [0.8, 2.6], // vertical wall, 1.8 mm tall
  [2.95, 4.95] // 45° chamfer up to the floor
]

/** The stacking lip, from the top of the bin up. */
export const LIP_PROFILE: ReadonlyArray<ProfileStep> = [
  [0, 0],
  [0.7, 0.7], // 45° chamfer
  [0.7, 2.5], // vertical wall, 1.8 mm tall
  [2.6, 4.4] // 45° chamfer
]

/** Height of the foot profile. */
export const BASE_PROFILE_HEIGHT = 4.95

/** Height of the stacking lip. */
export const LIP_HEIGHT = 4.4

/** Gap between the outer wall and the lip's groove at the top. */
export const LIP_OFFSET = 0.25

/** How far in from the outer wall the stacking lip reaches, at its widest. */
export const LIP_INSET = LIP_OFFSET + LIP_PROFILE[LIP_PROFILE.length - 1][0]

/** Thickness of a bin's outer wall. */
export const WALL_THICKNESS = 0.95

/** Radius of a bin's outer corners. */
export const OUTER_CORNER_RADIUS = 3.75

/** Height of the base, which is the least a bin can be. */
export const BASE_HEIGHT = 7

/** From the edge of a grid square to the center of a magnet or screw hole. */
export const MAGNET_HOLE_OFFSET = 8

/** Thickness of the floor between the feet and the inside of the bin. */
export const FLOOR_THICKNESS = 1.0
