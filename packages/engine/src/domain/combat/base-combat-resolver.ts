import { ActionType } from "#/domain/action/action-type";
import type { MoveAction } from "#/domain/action/interfaces";
import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import type { CombatResolver } from "#/domain/combat/interfaces";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";
import type { IItem } from "#/domain/item/interfaces";

/**
 * Base combat logic:
 * - Reinforcing allies adds troops.
 * - Attacking enemies/neutrals subtracts troops.
 * - Ownership changes if moving troops > defending troops.
 * - Leaves the general capture behavior to subclasses.
 */
export abstract class BaseCombatResolver implements CombatResolver {
  canMoveItem?: (item: IItem, player: IPlayer) => boolean;

  execute(
    action: MoveAction,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): boolean {
    const source = grid.get(action.from);
    const target = grid.get(action.to);
    const targetOwnerId = target?.owner?.playerId ?? null;

    if (!source || !target) {
      return false;
    }

    const dx = Math.abs(action.from.x - action.to.x);
    const dy = Math.abs(action.from.y - action.to.y);
    if (dx + dy !== 1) {
      return false; // Can only move to adjacent cells
    }

    const sourceOwnerId = source.owner?.playerId;
    if (sourceOwnerId !== action.playerId) {
      return false; // Can only move your own troops
    }

    if (!target.isPassable) {
      return false; // Cannot move into impassable terrain
    }

    const currentTroops = source.troopCount ?? 0;
    if (currentTroops <= 1) {
      return false; // Need at least 2 troops to move
    }

    // Determine how many troops are moving
    let movingTroops = currentTroops - 1;
    if (action.type === ActionType.SPLIT_MOVE) {
      movingTroops = Math.floor(currentTroops / 2);
    }

    const attacker = players.get(action.playerId);
    if (!attacker) {
      return false;
    }

    // Determine if it's a teammate (same player is also considered allied)
    let isAllied = false;
    if (target.owner) {
      const defender = players.get(target.owner.playerId);
      if (defender && defender.team.teamId === attacker.team.teamId) {
        isAllied = true;
      }
    }

    // Deduct troops from source
    source.addTroops(-movingTroops);

    let isSuccessfulOccupation = false;

    if (isAllied) {
      // Reinforce (including taking ownership if it was a teammate's tile)
      // Ownership transfers only if it's not a general, troops are merged regardless
      if (target.terrain !== Terrain.GENERAL) {
        target.owner = attacker;
      }
      target.troopCount = (target.troopCount ?? 0) + movingTroops;
      isSuccessfulOccupation = true;
    } else {
      // Attack
      const targetTroops = target.troopCount ?? 0;

      if (movingTroops > targetTroops) {
        // Attack succeeds, ownership transfers
        target.owner = attacker;
        target.troopCount = movingTroops - targetTroops;
        isSuccessfulOccupation = true;

        if (
          target.terrain === Terrain.GENERAL &&
          targetOwnerId &&
          targetOwnerId !== attacker.playerId
        ) {
          this.onGeneralCaptured(
            target,
            targetOwnerId,
            attacker,
            grid,
            players,
          );
        }
      } else if (movingTroops === targetTroops) {
        // Tie, ownership stays with defender but troops are depleted
        target.troopCount = 0;
      } else {
        // Attack fails, defender keeps ownership and remaining troops
        target.troopCount = targetTroops - movingTroops;
      }
    }

    // Move any items from source cell to target cell if occupation is successful
    if (isSuccessfulOccupation && source.items.length > 0) {
      const itemsToMove: IItem[] = [];
      const itemsToKeep: IItem[] = [];
      for (const item of source.items) {
        if (!this.canMoveItem || this.canMoveItem(item, attacker)) {
          item.coordinate = target.coordinate;
          itemsToMove.push(item);
        } else {
          itemsToKeep.push(item);
        }
      }
      source.items.length = 0;
      source.items.push(...itemsToKeep);
      target.items.push(...itemsToMove);
    }

    return true;
  }


  /**
   * Hook for subclasses to define what happens when a player's GENERAL is successfully conquered.
   *
   * @param target The GENERAL cell that was captured.
   * @param targetOwnerId The ID of the defeated player who owned the general.
   * @param attacker The player who successfully captured the general.
   * @param grid The game grid.
   * @param players Map of all players in the game.
   */
  protected abstract onGeneralCaptured(
    target: ICell,
    targetOwnerId: string,
    attacker: IPlayer,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): void;
}
