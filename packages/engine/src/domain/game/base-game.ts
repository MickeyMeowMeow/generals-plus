import type { Action } from "#/domain/action/interfaces";
import type { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type { IBaseGame } from "#/domain/game/interfaces";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IItem } from "#/domain/item/interfaces";
import type { IPlayer, IPlayerStats } from "#/domain/player/interfaces";
import type { Team } from "#/domain/team/interfaces";
import { VisibilityMap } from "#/domain/vision/visibility-map";
import type { IVisionGrid } from "#/domain/vision/vision-grid";

/**
 * Abstract base implementation for the Game Engine.
 * Subclasses should implement specific modes like StandardGame, DemolitionGame, etc.
 */
export abstract class BaseGame implements IBaseGame {
  public abstract readonly mode: GameMode;

  public status: GameStatus = GameStatus.NOT_STARTED;
  public tick: number = 0;

  public readonly grid: IGrid;
  public readonly players: Map<string, IPlayer> = new Map();
  public readonly teams: Map<string, Team> = new Map();
  public readonly items: IItem[] = [];
  protected readonly visibilityMap: VisibilityMap;

  constructor(grid: IGrid) {
    this.grid = grid;
    this.visibilityMap = new VisibilityMap(this.grid);
  }

  public startGame(): void {
    if (this.status !== GameStatus.NOT_STARTED) {
      return;
    }
    this.status = GameStatus.PLAYING;
    this.tick = 0;
  }

  public nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    this.tick++;

    // Next, specific modes will evaluate rules, e.g., checkGameEnd.
  }

  /**
   * Processes a player-initiated action.
   * This provides a base stub, typically overridden or extended by specific modes.
   *
   * @param _action The action to process.
   * @returns Whether the action was successfully processed.
   */
  public handleAction(_action: Action): boolean {
    if (this.status !== GameStatus.PLAYING) {
      return false;
    }
    return false; // To be overridden by specific modes
  }

  public abstract checkGameEnd(): IGameResult | null;

  public abstract forceEnd(): IGameResult;

  public getVisionGrid(playerId: string): IVisionGrid | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return this.visibilityMap.evaluate(player.team);
  }

  public abstract getPlayerStats(playerId: string): IPlayerStats | null;
}
