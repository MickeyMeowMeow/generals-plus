import type { GameMode } from "#/domain/game/game-mode";

/**
 * The final report generated when a game terminates.
 * This object is used for rendering the "Game Over" screen and for data persistence.
 */
export interface IGameResult {
  /** The GameMode that was played. */
  readonly mode: GameMode;

  /**
   * The ID of the winning Team.
   * Set to null if the game resulted in a draw or was terminated without a winner.
   */
  readonly winnerTeamId: string | null;
}
