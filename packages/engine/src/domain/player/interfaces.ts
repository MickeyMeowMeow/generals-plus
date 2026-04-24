import type { IEffectTarget } from "#domain/effect/interfaces";
import type { PlayerStatus } from "#domain/player/player-status";
import type { Team } from "#domain/team/interfaces";

/**
 * Represents a single player in an ongoing match.
 */
export interface IPlayer extends IEffectTarget {
  /** Team that the player belongs to. */
  team: Team;

  /** Lifecycle status of the player in this match. */
  status: PlayerStatus;
}
