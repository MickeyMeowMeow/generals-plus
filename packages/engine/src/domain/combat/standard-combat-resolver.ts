import { ActionType } from "#/domain/action/action-type";
import type { IAction } from "#/domain/action/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import type { CombatResolver } from "#/domain/combat/interfaces";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

/**
 * Standard combat logic:
 * - Reinforcing allies adds troops.
 * - Attacking enemies/neutrals subtracts troops.
 * - Ownership changes if moving troops > defending troops.
 */
export class StandardCombatResolver implements CombatResolver {
  public execute(
    action: IAction,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): boolean {
    if (!action.from || !action.to) {
      return false; // Invalid action without source or target
    }
    const source = grid.get(action.from);
    const target = grid.get(action.to);
    const targetOwnerId = target?.owner?.playerId ?? null;

    if (!source || !target) {
      return false;
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

    if (isAllied) {
      // Reinforce (including taking ownership if it was a teammate's tile)
      target.owner = attacker;
      target.troopCount = (target.troopCount ?? 0) + movingTroops;
    } else {
      // Attack
      const targetTroops = target.troopCount ?? 0;

      if (movingTroops > targetTroops) {
        // Attack succeeds, ownership transfers
        target.owner = attacker;
        target.troopCount = movingTroops - targetTroops;

        if (
          target.terrain === Terrain.GENERAL &&
          targetOwnerId &&
          targetOwnerId !== attacker.playerId
        ) {
          this.transferDefeatedPlayerResources(
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

    return true;
  }

  private transferDefeatedPlayerResources(
    defeatedPlayerId: string,
    attacker: IPlayer,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): void {
    const defeatedPlayer = players.get(defeatedPlayerId);
    if (defeatedPlayer) {
      defeatedPlayer.status = PlayerStatus.ELIMINATED;
    }

    grid.forEach((cell) => {
      if (cell.owner?.playerId === defeatedPlayerId) {
        cell.owner = attacker;
      }
    });
  }
}
