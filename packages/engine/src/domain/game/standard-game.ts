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
import type { IStandardGame } from "#/domain/game/interfaces";
import type { IStandardPlayerStats } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";

export class StandardGame extends BaseGame implements IStandardGame {
  public readonly mode = GameMode.CLASSIC;
  private readonly combatResolver = new StandardCombatResolver();

  public startGame(): void {
    super.startGame();
    let index = 0;
    const playersArray = Array.from(this.players.values());
    console.log("playersArray:", playersArray);
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.GENERAL) {
        cell.owner = playersArray[index] ?? null;
        index += 1;
      }
    });

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "standard-general-troop-gen",
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
        id: "standard-city-troop-gen",
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
        id: "standard-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );
  }

  public handleAction(action: Action): boolean {
    if (this.status !== GameStatus.PLAYING) {
      return false;
    }

    if (action.type === ActionType.CLEAR_QUEUE) {
      // Should not be processed by engine
      return false;
    }

    if (action.type === ActionType.SURRENDER) {
      return this.handleSurrender(action.playerId);
    }

    // The action must be a MoveAction at this point
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

  public nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    // Process all grid, player, and team effects (e.g. troop generation)
    super.nextTick();

    // Check game end immediately after processing actions and effects
    this.checkGameEnd();
  }

  public checkGameEnd(): IGameResult | null {
    if (this.status !== GameStatus.PLAYING) {
      return null;
    }

    // Basic logic for classic: if only one team has active players.
    const aliveTeams = new Set<string>();

    for (const player of this.players.values()) {
      if (player.status === PlayerStatus.ACTIVE) {
        aliveTeams.add(player.team.teamId);
      }
    }

    if (aliveTeams.size <= 1) {
      this.status = GameStatus.FINISHED;
      return {
        mode: this.mode,
        winnerTeamId: aliveTeams.values().next().value ?? null,
      };
    }

    return null;
  }

  public getPlayerStats(playerId: string): IStandardPlayerStats | null {
    const player = this.players.get(playerId);
    if (!player) return null;

    let troops = 0;
    let land = 0;
    let isGeneralAlive = false;

    this.grid.forEach((cell) => {
      if (cell.owner?.playerId === playerId) {
        land++;
        troops += cell.troopCount ?? 0;
        if (cell.terrain === Terrain.GENERAL) {
          isGeneralAlive = true;
        }
      }
    });

    return {
      playerId,
      troops,
      land,
      isGeneralAlive,
    };
  }

  public forceEnd(): IGameResult {
    this.status = GameStatus.FINISHED;
    return { mode: this.mode, winnerTeamId: null };
  }

  private handleSurrender(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }

    player.status = PlayerStatus.ELIMINATED;
    this.grid.forEach((cell) => {
      if (cell.owner?.playerId === playerId) {
        // Surrender keeps troop count but clears ownership to neutralize the army.
        cell.owner = null;
      }
    });

    this.checkGameEnd();
    return true;
  }
}
