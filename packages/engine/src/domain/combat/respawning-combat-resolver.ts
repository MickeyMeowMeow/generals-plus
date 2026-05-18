import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { BaseCombatResolver } from "#/domain/combat/base-combat-resolver";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

/**
 * Combat logic that allows generals to respawn upon defeat:
 * - Extends BaseCombatResolver for standard combat resolution.
 * - When a general is captured, it turns into a CITY.
 * - The defeated player keeps their remaining territory and respawns a general on a random remaining cell.
 * - If the defeated player has no remaining cells, they are eliminated.
 */
export class RespawningCombatResolver extends BaseCombatResolver {
  protected onGeneralCaptured(
    target: ICell,
    targetOwnerId: string,
    _attacker: IPlayer,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): void {
    // 1. The captured general tile turns into a plain
    target.terrain = Terrain.PLAIN;

    // 2. Find the defeated player
    const defeatedPlayer = players.get(targetOwnerId);
    if (!defeatedPlayer || defeatedPlayer.status !== PlayerStatus.ACTIVE) {
      return;
    }

    // 3. Look for remaining cells owned by the defeated player
    const ownedCells: ICell[] = [];
    grid.forEach((cell) => {
      if (cell.owner?.playerId === targetOwnerId) {
        ownedCells.push(cell);
      }
    });

    // 4. Handle respawn or elimination
    if (ownedCells.length > 0) {
      // Prioritize non-city tiles for respawning general to discourage city-camping and encourage land painting
      const nonCityCells = ownedCells.filter(
        (cell) => cell.terrain !== Terrain.CITY,
      );
      const candidates = nonCityCells.length > 0 ? nonCityCells : ownedCells;
      const randomCell =
        candidates[Math.floor(Math.random() * candidates.length)];
      randomCell.terrain = Terrain.GENERAL;
    } else {
      // No tiles left, player is eliminated
      defeatedPlayer.status = PlayerStatus.ELIMINATED;
    }
  }
}
