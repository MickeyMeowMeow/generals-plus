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
  /** The flag tile in Domination Mode. Generates score for the holding team. */
  FLAG: "flag",
  /** The bomb site tile in Demolition Mode. Where the bomb is planted. */
  BOMB_SITE: "bomb_site",
  /** The goal zone tile in Rugby Mode. Where rugby touchdowns are scored. */
  GOAL_ZONE: "goal_zone",
  /** The rugby spawn point tile in Rugby Mode. Where rugby balls spawn. */
  RUGBY_SPAWN: "rugby_spawn",
} as const;

export type Terrain = (typeof Terrain)[keyof typeof Terrain];
