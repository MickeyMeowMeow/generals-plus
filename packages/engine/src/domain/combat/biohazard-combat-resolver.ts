import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { BaseCombatResolver } from "#/domain/combat/base-combat-resolver";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";
import { TeamType } from "#/domain/team/team-type";

export class BiohazardCombatResolver extends BaseCombatResolver {
  onInfection:
    | ((infectedPlayerId: string, attackerPlayerId: string) => void)
    | null = null;

  protected onGeneralCaptured(
    target: ICell,
    targetOwnerId: string,
    attacker: IPlayer,
    grid: IGrid,
    players: Map<string, IPlayer>,
  ): void {
    const targetPlayer = players.get(targetOwnerId);
    if (!targetPlayer) return;

    const attackerIsZombie = attacker.team.type === TeamType.ZOMBIE;
    const targetIsHuman = targetPlayer.team.type === TeamType.HUMAN;

    if (attackerIsZombie && targetIsHuman) {
      // Infection: human converts to zombie, not eliminated.
      // Give the general back to the infected player so it stays as their base.
      target.owner = targetPlayer;

      // Neutralize all non-general territory.
      grid.forEach((cell) => {
        if (cell.owner?.playerId === targetOwnerId && cell !== target) {
          cell.owner = null;
        }
      });
      this.onInfection?.(targetOwnerId, attacker.playerId);
    } else {
      // Standard elimination (human kills zombie, or pre-outbreak FFA)
      target.terrain = Terrain.CITY;
      targetPlayer.status = PlayerStatus.ELIMINATED;
      grid.forEach((cell) => {
        if (cell.owner?.playerId === targetOwnerId) {
          cell.owner = attacker;
        }
      });
    }
  }
}
