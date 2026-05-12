import type { EffectTarget } from "#/domain/effect/effect-target";
import type { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";

/**
 * Represents a single player in an ongoing match.
 */
export interface IPlayer extends EffectTarget {
  /** Unique ID for the player. */
  readonly playerId: string;

  /** Team that the player belongs to. */
  team: Team;

  /** Lifecycle status of the player in this match. */
  status: PlayerStatus;
}

/**
 * Fundamental state of a player, excluding dynamic scores like troops and land.
 */
export interface IPlayerState {
  readonly playerId: string;
  readonly teamId: string;
  readonly status: PlayerStatus;
}
