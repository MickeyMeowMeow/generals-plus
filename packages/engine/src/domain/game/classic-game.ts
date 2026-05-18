import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { StandardCombatResolver } from "#/domain/combat/standard-combat-resolver";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type {
  IClassicGame,
  IClassicScoreboard,
} from "#/domain/game/interfaces";

export class ClassicGame extends BaseGame implements IClassicGame {
  readonly mode = GameMode.CLASSIC;
  private readonly combatResolver = new StandardCombatResolver();

  startGame(): void {
    super.startGame();
    this.assignStartPositions();

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "classic-general-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "classic-city-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "classic-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );
  }

  protected executeAction(action: Action): boolean {
    if (
      action.type !== ActionType.MOVE &&
      action.type !== ActionType.SPLIT_MOVE
    ) {
      return false;
    }
    const success = this.combatResolver.execute(
      action,
      this.grid,
      this.players,
    );

    // Check game end immediately if an action might have ended the game
    if (success) {
      this.checkGameEnd();
    }

    return success;
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    // Process all grid, player, and team effects (e.g. troop generation)
    super.nextTick();

    // Check game end immediately after processing actions and effects
    this.checkGameEnd();
  }

  protected evaluateGameEnd(): IGameResult | null {
    // Basic logic for classic: if only one team has active players.
    const aliveTeams = this.getAliveTeams();

    if (aliveTeams.size <= 1) {
      return {
        mode: this.mode,
        winnerTeamId: aliveTeams.values().next().value ?? null,
      };
    }

    return null;
  }

  getScoreboard(): IClassicScoreboard {
    const baseScores = this.calculateBaseScores();
    const generals = new Set<string>();

    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.GENERAL && cell.owner) {
        generals.add(cell.owner.playerId);
      }
    });

    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => ({
        playerId,
        troops: score.troops,
        land: score.land,
        isAlive: generals.has(playerId),
      }),
    );

    return {
      mode: this.mode,
      players,
    };
  }
}
