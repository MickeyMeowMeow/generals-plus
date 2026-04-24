export const Terrain = {
  /** Standard walkable terrain. Generates troops when owned. */
  PLAIN: "plain",
  /** Player's capital. Capturing this eliminates the player. */
  GENERAL: "general",
  /** Impassable terrain. Blocks movement and pathfinding. */
  MOUNTAIN: "mountain",
  /** Drains troops per turn. */
  SWAMP: "swamp",
  /** Does not generate troops. */
  DESERT: "desert",
  /** Requires troops to capture, generates troops when owned. */
  CITY: "city",
  /** Void terrain. Not part of the playable grid, used for padding. */
  VOID: "void",
} as const;

export type Terrain = (typeof Terrain)[keyof typeof Terrain];
