import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import type { ICell } from "#/domain/cell/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { EffectRegistry } from "#/domain/effect/effect-registry";
import type { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type { IBaseGame, IBaseScoreboard } from "#/domain/game/interfaces";
import type { Grid } from "#/domain/grid/grid";
import type { GridInput } from "#/domain/grid/grid-generator";
import { DefaultGridGenerator } from "#/domain/grid/grid-generator";
import type { IItem } from "#/domain/item/interfaces";
import type { IPlayer, IPlayerState } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";
import { VisibilityMap } from "#/domain/vision/visibility-map";
import type { IVisionGrid } from "#/domain/vision/vision-grid";

/**
 * Abstract base implementation for the Game Engine.
 * Subclasses should implement specific modes like ClassicGame, DemolitionGame, etc.
 */
export abstract class BaseGame implements IBaseGame {
  abstract readonly mode: GameMode;

  status: GameStatus = GameStatus.NOT_STARTED;
  tick: number = 0;

  readonly grid: Grid;
  readonly players: Map<string, IPlayer> = new Map();
  readonly teams: Map<string, Team> = new Map();
  readonly items: IItem[] = [];
  readonly effectRegistry = new EffectRegistry();
  protected readonly visibilityMap: VisibilityMap;

  constructor(input: GridInput) {
    this.grid =
      "grid" in input ? input.grid : new DefaultGridGenerator().generate(input);
    this.visibilityMap = new VisibilityMap(this.grid);
  }

  startGame(): void {
    if (this.status !== GameStatus.NOT_STARTED) {
      return;
    }
    this.status = GameStatus.PLAYING;
    this.tick = 0;
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    this.tick++;

    this.effectRegistry.processTick(this.tick);

    // Next, specific modes will evaluate rules, e.g., checkGameEnd.
  }

  /**
   * Processes a player-initiated action.
   * Handles common actions like CLEAR_QUEUE and SURRENDER.
   * Delegates mode-specific actions to executeAction().
   *
   * @param action The action to process.
   * @returns Whether the action was successfully processed.
   */
  handleAction(action: Action): boolean {
    if (this.status !== GameStatus.PLAYING) {
      return false;
    }

    if (action.type === ActionType.CLEAR_QUEUE) {
      return false;
    }

    if (action.type === ActionType.SURRENDER) {
      return this.handleSurrender(action.playerId);
    }

    return this.executeAction(action);
  }

  /**
   * Mode-specific action execution (e.g. MOVE, SKILL).
   * @param action The action to process.
   * @returns Whether the action was successfully processed.
   */
  protected executeAction(_action: Action): boolean {
    return false;
  }

  protected handleSurrender(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.status !== PlayerStatus.ACTIVE) {
      return false;
    }

    player.status = PlayerStatus.ELIMINATED;
    this.grid.forEach((cell) => {
      if (cell.owner?.playerId === playerId) {
        cell.owner = null;
        this.onCellNeutralized(cell);
      }
    });

    this.checkGameEnd();
    return true;
  }

  /**
   * Hook for subclasses to modify a cell when a player surrenders and loses ownership.
   */
  protected onCellNeutralized(_cell: ICell): void {
    // Default no-op
  }

  protected cachedGameResult: IGameResult | null = null;

  checkGameEnd(): IGameResult | null {
    if (this.status !== GameStatus.PLAYING) {
      return this.cachedGameResult;
    }

    const result = this.evaluateGameEnd();
    if (result) {
      this.status = GameStatus.FINISHED;
      this.cachedGameResult = result;
    }
    return result;
  }

  protected abstract evaluateGameEnd(): IGameResult | null;

  forceEnd(): IGameResult {
    this.status = GameStatus.FINISHED;
    this.cachedGameResult = { mode: this.mode, winnerTeamId: null };
    return this.cachedGameResult;
  }

  getVisionGrid(playerId: string): IVisionGrid | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return this.visibilityMap.evaluate(
      player.team,
      this.status === GameStatus.FINISHED,
    );
  }

  getPlayerState(playerId: string): IPlayerState | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return {
      playerId: player.playerId,
      teamId: player.team.teamId,
      status: player.status,
    };
  }

  abstract getScoreboard(): IBaseScoreboard;

  protected calculateBaseScores(): Map<
    string,
    { troops: number; land: number }
  > {
    const scores = new Map<string, { troops: number; land: number }>();
    for (const player of this.players.values()) {
      scores.set(player.playerId, { troops: 0, land: 0 });
    }

    this.grid.forEach((cell) => {
      if (cell.owner) {
        const score = scores.get(cell.owner.playerId);
        if (score) {
          score.land++;
          score.troops += cell.troopCount ?? 0;
        }
      }
    });

    return scores;
  }

  protected getAliveTeams(): Set<string> {
    const aliveTeams = new Set<string>();
    for (const player of this.players.values()) {
      if (player.status === PlayerStatus.ACTIVE) {
        aliveTeams.add(player.team.teamId);
      }
    }
    return aliveTeams;
  }

  protected assignStartPositions(
    targetTerrain: Terrain = Terrain.GENERAL,
  ): void {
    let index = 0;
    const playersArray = Array.from(this.players.values());
    this.grid.forEach((cell) => {
      if (cell.terrain === Terrain.GENERAL) {
        cell.terrain = targetTerrain;
        cell.owner = playersArray[index] ?? null;
        index += 1;
      }
    });
  }
}
