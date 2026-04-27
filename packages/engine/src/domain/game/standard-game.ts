import type { IAction } from "#/domain/action/interfaces";
import { StandardCombatResolver } from "#/domain/combat/standard-combat-resolver";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type { IStandardGame } from "#/domain/game/interfaces";
import type { IGrid } from "#/domain/grid/interfaces";
import type { IStandardPlayerStats } from "#/domain/player/interfaces";
import { Terrain } from "#/domain/cell/terrain";

export class StandardGame extends BaseGame implements IStandardGame {
  public readonly mode = GameMode.CLASSIC;
  private readonly combatResolver = new StandardCombatResolver();

  constructor(grid: IGrid) {
    super(grid);
  }

  public handleAction(action: IAction): boolean {
    if (this.status !== GameStatus.PLAYING) {
      return false;
    }

    // Process the action synchronously
    const success = this.combatResolver.execute(action, this.grid, this.players);

    // Optional: check game end immediately if an action might have ended the game
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

    // Optional: check game end immediately after processing actions and effects
    this.checkGameEnd();
  }

  public checkGameEnd(): IGameResult | null {
    if (this.status !== GameStatus.PLAYING) {
      return null;
    }

    // Basic logic for classic: if only one team has active players.
    const aliveTeams = new Set<string>();

    for (const player of this.players.values()) {
      if (player.status === "active") {
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
}
