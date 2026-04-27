import type { IEffectTarget } from "#/domain/effect/interfaces";
import type { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";

/**
 * Represents a single player in an ongoing match.
 */
export interface IPlayer extends IEffectTarget {
  /** Unique ID for the player. */
  readonly playerId: string;

  /** Team that the player belongs to. */
  team: Team;

  /** Lifecycle status of the player in this match. */
  status: PlayerStatus;
}

/**
 * Base statistics for a player at a given point in time.
 */
export interface IPlayerStats {
  readonly playerId: string;
  readonly troops: number;
  readonly land: number;
}

/**
 * Statistics specific to standard/classic mode.
 */
export interface IStandardPlayerStats extends IPlayerStats {
  /** Whether the player's general is still alive on the map. */
  readonly isGeneralAlive: boolean;
}
