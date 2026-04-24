import type { PlayerStatus } from "#domain/player/player-status";
import type { Team } from "#domain/team/interfaces";
import type { Visibility } from "#domain/vision/visibility";
import type { ICoordinate } from "#math/coordinate";

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

/**
 * Represents a specific team's evaluated view of the entire grid.
 */
export interface IVisibilityMap {
  /** Team for which this visibility map is evaluated. */
  readonly team: IVisionTeam;

  /**
   * Evaluates the current visibility level of a specific coordinate for the map's owner.
   *
   * @param coordinate The grid location to query.
   * @returns The visibility level for the map's owner.
   */
  getVisibility(coordinate: ICoordinate): Visibility;
}
