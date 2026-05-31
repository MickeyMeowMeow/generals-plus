import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { StandardTeam } from "#/domain/team/team";

class TestGame extends BaseGame {
  readonly mode = GameMode.CLASSIC;

  evaluateGameEnd() {
    return null;
  }

  getScoreboard() {
    return {
      mode: GameMode.CLASSIC,
    };
  }

  public testAssignStartPositions(targetTerrain?: Terrain) {
    this.assignStartPositions(targetTerrain);
  }
}

function createGame(): TestGame {
  const grid = new SquareGrid(1, 1, [
    [
      new Cell({
        coordinate: { x: 0, y: 0 },
        terrain: Terrain.PLAIN,
      }),
    ],
  ]);
  return new TestGame({ grid });
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

  it("converts extra general cells to plain cells when spawnPositions is defined", () => {
    const grid = new SquareGrid(3, 1, [
      [
        new Cell({
          coordinate: { x: 0, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 1,
        }),
        new Cell({
          coordinate: { x: 1, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 2,
        }),
        new Cell({
          coordinate: { x: 2, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 3,
        }),
      ],
    ]);
    const game = new TestGame({ grid });
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    game.players.set(player.playerId, player);

    // Map p1 to cell (0, 0)
    game.spawnPositions = new Map([["p1", { x: 0, y: 0 }]]);

    game.testAssignStartPositions();

    const cell0 = grid.get({ x: 0, y: 0 });
    const cell1 = grid.get({ x: 1, y: 0 });
    const cell2 = grid.get({ x: 2, y: 0 });

    // Assigned spawn cell should keep its terrain (defaults to GENERAL) and get owner
    expect(cell0).not.toBeNull();
    expect(cell0?.terrain).toBe(Terrain.GENERAL);
    expect(cell0?.owner).toBe(player);

    // Unassigned spawn cells should become PLAIN with null owner and null troopCount
    expect(cell1).not.toBeNull();
    expect(cell1?.terrain).toBe(Terrain.PLAIN);
    expect(cell1?.owner).toBeNull();
    expect(cell1?.troopCount).toBeNull();

    expect(cell2).not.toBeNull();
    expect(cell2?.terrain).toBe(Terrain.PLAIN);
    expect(cell2?.owner).toBeNull();
    expect(cell2?.troopCount).toBeNull();
  });

  it("converts extra general cells to plain cells when spawnPositions is NOT defined", () => {
    const grid = new SquareGrid(3, 1, [
      [
        new Cell({
          coordinate: { x: 0, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 1,
        }),
        new Cell({
          coordinate: { x: 1, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 2,
        }),
        new Cell({
          coordinate: { x: 2, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 3,
        }),
      ],
    ]);
    const game = new TestGame({ grid });
    const team1 = new StandardTeam("t1");
    const team2 = new StandardTeam("t2");
    const player1 = new Player(team1, "p1");
    const player2 = new Player(team2, "p2");
    game.players.set(player1.playerId, player1);
    game.players.set(player2.playerId, player2);

    game.testAssignStartPositions();

    const cell0 = grid.get({ x: 0, y: 0 });
    const cell1 = grid.get({ x: 1, y: 0 });
    const cell2 = grid.get({ x: 2, y: 0 });

    // First two general cells assigned to players
    expect(cell0).not.toBeNull();
    expect(cell0?.terrain).toBe(Terrain.GENERAL);
    expect(cell0?.owner).toBe(player1);

    expect(cell1).not.toBeNull();
    expect(cell1?.terrain).toBe(Terrain.GENERAL);
    expect(cell1?.owner).toBe(player2);

    // Third general cell is extra and should become PLAIN with null owner and null troopCount
    expect(cell2).not.toBeNull();
    expect(cell2?.terrain).toBe(Terrain.PLAIN);
    expect(cell2?.owner).toBeNull();
    expect(cell2?.troopCount).toBeNull();
  });
});
