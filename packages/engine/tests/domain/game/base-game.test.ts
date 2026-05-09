import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { Grid } from "#/domain/grid/grid";
import type { IPlayerStats } from "#/domain/player/interfaces";
import { Player } from "#/domain/player/player";
import { StandardTeam } from "#/domain/team/team";

class TestGame extends BaseGame {
  readonly mode = GameMode.CLASSIC;

  checkGameEnd() {
    return null;
  }

  forceEnd() {
    this.status = GameStatus.FINISHED;
    return { mode: this.mode, winnerTeamId: null };
  }

  getPlayerStats(playerId: string): IPlayerStats | null {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }
    return { playerId, troops: 0, land: 0 };
  }
}

function createGame(): TestGame {
  const grid = new Grid(1, 1, [
    [
      new Cell({
        coordinate: { x: 0, y: 0 },
        terrain: Terrain.PLAIN,
      }),
    ],
  ]);
  return new TestGame(grid);
}

describe("BaseGame", () => {
  it("starts only once and moves to playing", () => {
    const game = createGame();

    game.startGame();
    expect(game.status).toBe(GameStatus.PLAYING);
    expect(game.tick).toBe(0);

    game.tick = 10;
    game.startGame();
    expect(game.tick).toBe(10);
  });

  it("increments tick only when playing", () => {
    const game = createGame();

    game.nextTick();
    expect(game.tick).toBe(0);

    game.startGame();
    game.nextTick();
    expect(game.tick).toBe(1);
  });

  it("default handleAction returns false", () => {
    const game = createGame();
    const action: Action = {
      playerId: "p1",
      type: ActionType.MOVE,
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
    };

    expect(game.handleAction(action)).toBe(false);

    game.startGame();
    expect(game.handleAction(action)).toBe(false);
  });

  it("returns null vision for unknown player and vision grid for known player", () => {
    const game = createGame();
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    team.addPlayer(player);
    game.players.set(player.playerId, player);

    expect(game.getVisionGrid("missing")).toBeNull();
    expect(game.getVisionGrid("p1")).not.toBeNull();
  });
});
