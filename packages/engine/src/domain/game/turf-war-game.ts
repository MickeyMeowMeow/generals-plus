import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { RespawningCombatResolver } from "#/domain/combat/respawning-combat-resolver";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type {
  ITurfWarGame,
  ITurfWarScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import { PlayerStatus } from "#/domain/player/player-status";

export interface TurfWarGameOptions {
  finishTick?: number;
}

export class TurfWarGame extends BaseGame implements ITurfWarGame {
  readonly mode = GameMode.TURF_WAR;
  private readonly combatResolver = new RespawningCombatResolver();
  private readonly maxTicks: number;

  constructor(input: GridInput, options?: TurfWarGameOptions) {
    super(input);
    this.maxTicks = options?.finishTick ?? 360;
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions();

    // Double troop generation speed
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "turfwar-general-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: 2,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "turfwar-city-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: 2,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "turfwar-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 2,
        interval: 25,
      }),
    );
  }

  protected executeAction(action: Action): boolean {
    if (action.type !== ActionType.MOVE) {
      return false;
    }
    const success = this.combatResolver.execute(
      action,
      this.grid,
      this.players,
    );

    if (success) {
      this.checkGameEnd();
    }

    return success;
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    super.nextTick();

    this.checkGameEnd();
  }

  protected evaluateGameEnd(): IGameResult | null {
    const aliveTeams = this.getAliveTeams();

    // Win condition 1: Only one team left
    if (aliveTeams.size <= 1) {
      return {
        mode: this.mode,
        winnerTeamId: aliveTeams.values().next().value ?? null,
      };
    }

    // Win condition 2: Time limit reached (3 minutes)
    if (this.tick >= this.maxTicks) {
      // Count land per team
      const teamLand = new Map<string, number>();
      this.grid.forEach((cell) => {
        if (cell.owner && cell.owner.status === PlayerStatus.ACTIVE) {
          const player = this.players.get(cell.owner.playerId);
          if (player) {
            const teamId = player.team.teamId;
            teamLand.set(teamId, (teamLand.get(teamId) ?? 0) + 1);
          }
        }
      });

      let winnerTeamId: string | null = null;
      let maxLand = -1;

      for (const [teamId, land] of teamLand.entries()) {
        if (land > maxLand) {
          maxLand = land;
          winnerTeamId = teamId;
        } else if (land === maxLand) {
          winnerTeamId = null; // Tie
        }
      }

      return {
        mode: this.mode,
        winnerTeamId,
      };
    }

    return null;
  }

  getScoreboard(): ITurfWarScoreboard {
    const baseScores = this.calculateBaseScores();
    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => ({
        playerId,
        troops: score.troops,
        land: score.land,
        isAlive: this.players.get(playerId)?.status === PlayerStatus.ACTIVE,
      }),
    );

    const teamLand = new Map<string, number>();
    let capturableTotal = 0;
    this.grid.forEach((cell) => {
      if (cell.terrain !== Terrain.MOUNTAIN && cell.terrain !== Terrain.VOID) {
        capturableTotal++;
        if (cell.owner) {
          const player = this.players.get(cell.owner.playerId);
          if (player) {
            const teamId = player.team.teamId;
            teamLand.set(teamId, (teamLand.get(teamId) ?? 0) + 1);
          }
        }
      }
    });

    const teams = Array.from(this.teams.values()).map((team) => ({
      teamId: team.teamId,
      playerIds: team.players.map((p) => p.playerId),
      landPercent:
        capturableTotal > 0
          ? Math.round(
              ((teamLand.get(team.teamId) ?? 0) / capturableTotal) * 100,
            )
          : 0,
    }));

    return {
      mode: this.mode,
      players,
      teams,
    };
  }

  protected onCellNeutralized(cell: ICell): void {
    if (cell.terrain === Terrain.GENERAL) {
      cell.terrain = Terrain.CITY;
    }
  }
}
