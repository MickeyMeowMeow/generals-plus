import type { EffectTarget } from "#/domain/effect/effect-target";
import type { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";

/**
 * Represents a single player in an ongoing match.
 */
export interface IPlayer extends EffectTarget {
  /** Team that the player belongs to. */
  team: Team;

  /** Lifecycle status of the player in this match. */
  status: PlayerStatus;
}

/**
 * Represents a player that is currently active in the match.
 */
export interface ActivePlayer extends IPlayer {
  status: typeof PlayerStatus.ACTIVE;
}
