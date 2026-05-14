import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { BaseCombatResolver } from "#/domain/combat/base-combat-resolver";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

/**
 * Standard combat logic:
 * - Reinforcing allies adds troops.
 * - Attacking enemies/neutrals subtracts troops.
 * - Ownership changes if moving troops > defending troops.
 * - Capturing a general turns it into a city and transfers all resources to the attacker.
 */
export class StandardCombatResolver extends BaseCombatResolver {
  protected onGeneralCaptured(
    target: ICell,
    targetOwnerId: string,
    attacker: IPlayer,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): void {
    target.terrain = Terrain.CITY;
    this.transferDefeatedPlayerResources(
      targetOwnerId,
      attacker,
      grid,
      players,
    );
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
