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
  IDominationGame,
  IDominationScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import { PlayerStatus } from "#/domain/player/player-status";

export interface DominationGameOptions {
  targetScore?: number;
  finishTick?: number;
}

export class DominationGame extends BaseGame implements IDominationGame {
  readonly mode = GameMode.DOMINATION;
  private readonly combatResolver = new StandardCombatResolver();

  readonly targetScore: number;
  readonly teamScores = new Map<string, number>();

  private readonly maxTicks: number;
  private readonly flagHoldState = new Map<
    string,
    { teamId: string; ticks: number }
  >();

  constructor(input: GridInput, options?: DominationGameOptions) {
    super(input);
    this.targetScore = options?.targetScore ?? 1000;
    this.maxTicks = options?.finishTick ?? 600;
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions(Terrain.CITY); // Start positions are normal cities

    // Initialize team scores
    for (const team of this.teams.values()) {
      this.teamScores.set(team.teamId, 0);
    }

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "domination-city-troop-gen",
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
        id: "domination-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "domination-flag-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.FLAG,
        delta: 1,
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

    if (success && action.type === ActionType.MOVE) {
      this.checkEliminations();
    }

    if (success) {
      this.checkGameEnd();
    }

    return success;
  }

  private checkEliminations(): void {
    for (const player of this.players.values()) {
      if (player.status !== PlayerStatus.ACTIVE) continue;

      let hasLand = false;
      this.grid.forEach((cell) => {
        if (cell.owner?.playerId === player.playerId) {
          hasLand = true;
        }
      });

      if (!hasLand) {
        this.handleSurrender(player.playerId);
      }
    }
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    super.nextTick();

    // Score generation logic for FLAG
    this.grid.forEachTerrain(Terrain.FLAG, (flagCell) => {
      const cellId = `${flagCell.coordinate.x},${flagCell.coordinate.y}`;
      let currentOwnerTeamId: string | null = null;

      if (flagCell.owner && flagCell.owner.status === PlayerStatus.ACTIVE) {
        const player = this.players.get(flagCell.owner.playerId);
        if (player) {
          currentOwnerTeamId = player.team.teamId;
        }
      }

      if (currentOwnerTeamId) {
        let holdState = this.flagHoldState.get(cellId);
        if (holdState && holdState.teamId === currentOwnerTeamId) {
          holdState.ticks++;
        } else {
          holdState = { teamId: currentOwnerTeamId, ticks: 1 };
          this.flagHoldState.set(cellId, holdState);
        }

        // Calculate score increment (e.g., base 1 + bonus every 100 ticks held)
        const increment = 1 + Math.floor(holdState.ticks / 100);
        const currentScore = this.teamScores.get(currentOwnerTeamId) ?? 0;
        this.teamScores.set(currentOwnerTeamId, currentScore + increment);
      } else {
        this.flagHoldState.delete(cellId);
      }
    });

    this.checkGameEnd();
  }

  protected evaluateGameEnd(): IGameResult | null {
    const aliveTeams = this.getAliveTeams();
    if (aliveTeams.size <= 1) {
      return {
        mode: this.mode,
        winnerTeamId: aliveTeams.values().next().value ?? null,
      };
    }

    let maxScore = -1;
    let winnerTeamId: string | null = null;
    let targetReached = false;

    for (const [teamId, score] of this.teamScores.entries()) {
      if (score >= this.targetScore) {
        targetReached = true;
      }
      if (score > maxScore) {
        maxScore = score;
        winnerTeamId = teamId;
      } else if (score === maxScore) {
        winnerTeamId = null; // Tie
      }
    }

    if (targetReached || this.tick >= this.maxTicks) {
      return {
        mode: this.mode,
        winnerTeamId,
      };
    }

    return null;
  }

  getScoreboard(): IDominationScoreboard {
    const baseScores = this.calculateBaseScores();
    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => {
        const player = this.players.get(playerId);
        return {
          playerId,
          troops: score.troops,
          land: score.land,
          isAlive: player?.status === PlayerStatus.ACTIVE,
        };
      },
    );

    return {
      mode: this.mode,
      players,
      teamScores: new Map(this.teamScores),
    };
  }
}
