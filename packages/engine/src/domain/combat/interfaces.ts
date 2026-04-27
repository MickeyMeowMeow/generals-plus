import type { MoveAction } from "#/domain/action/interfaces";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";

/**
 * Strategy interface for resolving and executing troop movements and combats.
 */
export interface CombatResolver {
  /**
   * Evaluates the outcome of troops moving into a cell and mutates the grid accordingly.
   *
   * @param action The movement action containing from, to, and playerId.
   * @param grid The game grid containing the cells.
   * @returns True if the combat movement was successfully executed.
   */
  execute(
    action: MoveAction,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): boolean;
}
