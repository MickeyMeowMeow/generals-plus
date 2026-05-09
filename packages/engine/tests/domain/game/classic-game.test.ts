import { describe, expect, it, test } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import type { Action, MoveAction } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { ClassicGame } from "#/domain/game/classic-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { Grid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function createGridForAction(): Grid {
  return new Grid(2, 1, [
    [
      new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
      new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.PLAIN }),
    ],
  ]);
}

function createMoveAction(playerId = "p1"): MoveAction {
  return {
    playerId,
    type: ActionType.MOVE,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  };
}

function createSurrenderAction(playerId = "p1"): Action {
  return {
    playerId,
    type: ActionType.SURRENDER,
  };
}

describe("ClassicGame", () => {
  it("rejects actions when game is not playing", () => {
    const game = new ClassicGame(createGridForAction());

    expect(game.handleAction(createMoveAction())).toBe(false);
  });

  it("processes valid action while playing", () => {
    const grid = createGridForAction();
    const game = new ClassicGame(grid);
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t2, "p2");
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const source = grid.get({ x: 0, y: 0 });
    const target = grid.get({ x: 1, y: 0 });
    if (!source || !target) {
      throw new Error("cells should exist");
    }
    source.owner = p1;
    source.troopCount = 5;
    target.owner = p2;
    target.troopCount = 2;

    game.startGame();
    const result = game.handleAction(createMoveAction());

    expect(result).toBe(true);
    expect(source.troopCount).toBe(1);
    expect(target.owner).toBe(p1);
  });

  it("finishes game when one or zero alive teams remain", () => {
    const game = new ClassicGame(createGridForAction());
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);

    game.startGame();
    const result = game.checkGameEnd();

    expect(result).toEqual({ mode: GameMode.CLASSIC, winnerTeamId: "t1" });
    expect(game.status).toBe(GameStatus.FINISHED);
  });

  test("nextTick increments and can trigger end-check", () => {
    const game = new ClassicGame(createGridForAction());
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);

    game.startGame();
    game.nextTick();

    expect(game.tick).toBe(1);
    expect(game.status).toBe(GameStatus.FINISHED);
  });

  test("generates troops via effects during nextTick", () => {
    const grid = new Grid(3, 1, [
      [
        new Cell({
          coordinate: { x: 0, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 1,
        }),
        new Cell({
          coordinate: { x: 1, y: 0 },
          terrain: Terrain.CITY,
          troopCount: 0,
        }),
        new Cell({
          coordinate: { x: 2, y: 0 },
          terrain: Terrain.PLAIN,
          troopCount: 0,
        }),
      ],
    ]);
    const game = new ClassicGame(grid);
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const generalCell = grid.get({ x: 0, y: 0 })!;
    const cityCell = grid.get({ x: 1, y: 0 })!;
    const plainCell = grid.get({ x: 2, y: 0 })!;

    // Make p1 own everything
    cityCell.owner = p1;
    plainCell.owner = p1;

    // startGame overrides General owner to playersArray[0] which is p1
    game.startGame();
    expect(generalCell.owner).toBe(p1);

    game.nextTick(); // tick 1: general +1, city +1, plain +0
    expect(generalCell.troopCount).toBe(2);
    expect(cityCell.troopCount).toBe(1);
    expect(plainCell.troopCount).toBe(0);

    // Run until tick 25
    for (let i = 2; i <= 25; i++) {
      game.nextTick();
    }

    // At tick 25:
    // General generated 25 times total (1 initial + 25 = 26)
    // City generated 25 times total (0 initial + 25 = 25)
    // Plain generated 1 time total (0 initial + 1 = 1)
    expect(generalCell.troopCount).toBe(26);
    expect(cityCell.troopCount).toBe(25);
    expect(plainCell.troopCount).toBe(1);
  });

  it("computes player stats from owned cells", () => {
    const grid = new Grid(2, 1, [
      [
        new Cell({
          coordinate: { x: 0, y: 0 },
          terrain: Terrain.GENERAL,
          troopCount: 7,
        }),
        new Cell({
          coordinate: { x: 1, y: 0 },
          terrain: Terrain.CITY,
          troopCount: 3,
        }),
      ],
    ]);
    const game = new ClassicGame(grid);
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1");
    game.players.set(p1.playerId, p1);

    const c1 = grid.get({ x: 0, y: 0 });
    const c2 = grid.get({ x: 1, y: 0 });
    if (!c1 || !c2) {
      throw new Error("cells should exist");
    }
    c1.owner = p1;
    c2.owner = p1;

    expect(game.getPlayerState("missing")).toBeNull();
    expect(game.getPlayerState("p1")).toEqual({
      playerId: "p1",
      teamId: "t1",
      status: PlayerStatus.ACTIVE,
    });

    const scoreboard = game.getScoreboard();
    expect(scoreboard.mode).toBe(GameMode.CLASSIC);
    expect(scoreboard.players).toContainEqual({
      playerId: "p1",
      troops: 10,
      land: 2,
      isGeneralAlive: true,
    });
  });

  test("forceEnd always sets finished with null winner", () => {
    const game = new ClassicGame(createGridForAction());

    const result = game.forceEnd();

    expect(game.status).toBe(GameStatus.FINISHED);
    expect(result).toEqual({ mode: GameMode.CLASSIC, winnerTeamId: null });
  });

  test("surrender neutralizes all owned troops and can end the game", () => {
    const grid = new Grid(3, 1, [
      [
        new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
        new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.CITY }),
        new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.PLAIN }),
      ],
    ]);
    const game = new ClassicGame(grid);
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const c1 = grid.get({ x: 0, y: 0 });
    const c2 = grid.get({ x: 1, y: 0 });
    if (!c1 || !c2) {
      throw new Error("cells should exist");
    }

    c1.owner = p1;
    c1.troopCount = 9;
    c2.owner = p1;
    c2.troopCount = 4;

    game.startGame();
    const success = game.handleAction(createSurrenderAction("p1"));

    expect(success).toBe(true);
    expect(c1.owner).toBeNull();
    expect(c2.owner).toBeNull();
    expect(c1.troopCount).toBe(9);
    expect(c2.troopCount).toBe(4);
    expect(p1.status).toBe(PlayerStatus.ELIMINATED);
    expect(game.status).toBe(GameStatus.FINISHED);
    expect(game.checkGameEnd()).toBeNull();
  });
});
