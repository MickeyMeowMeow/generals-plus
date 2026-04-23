import type { PlayerStatus } from "@/domain/player/player-status";

/**
 * Represents a single player in an ongoing match.
 */
export interface IPlayer {
  /** Unique ID of the player in the current match. */
  readonly id: string;
  /** Team ID this player belongs to, or null in free-for-all modes. */
  teamId: string | null;
  /** Lifecycle status of the player in this match. */
  status: PlayerStatus;
}
