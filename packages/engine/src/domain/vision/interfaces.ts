import type { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";


export interface IVisionPlayer {
  team: Team;
  status: PlayerStatus;
}

export interface IVisionTeam {
  readonly players: IVisionPlayer[];
}

/**
 * Defines a quantitative contribution to a player's sight.
 */
export interface IVisionModifier {
  /**
   * The radius of sight granted by this modifier.
   * A radius of 1 typically reveals the host cell and its immediate orthogonal neighbors.
   */
  readonly radius: number;
}

