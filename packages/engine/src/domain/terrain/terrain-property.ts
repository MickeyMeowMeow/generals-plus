/**
 * Defines the time-based effects of a terrain.
 */
export interface ITickingEffect {
  /** Troops gained or lost per interval. */
  readonly troopDelta: number;
  /** Number of ticks between each troop change. */
  readonly interval: number;
}

/**
 * Defines the behaviorial properties of a terrain type.
 */
export interface ITerrainProperties {
  /** Whether the terrain can be traversed by troops. */
  readonly isPassable: boolean;
  /** Whether the terrain can be occupied by players. */
  readonly isOccupiable: boolean;
  /** Optional ticking effect that applies to this terrain, such as troop generation or drain. */
  readonly ticking?: ITickingEffect;
}
