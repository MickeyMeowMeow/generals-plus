import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import type { MoveAction } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import { TurfWarGame } from "#/domain/game/turf-war-game";
import { Grid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function createGridForTurfWar(): Grid {
  return new Grid(3, 1, [
    [
      new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.GENERAL }),
      new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.GENERAL }),
      new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.PLAIN }),
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

describe("TurfWarGame", () => {
  it("finishes game when one alive team remains", () => {
    const grid = createGridForTurfWar();
    const game = new TurfWarGame(grid);
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);

    game.startGame();
    // Simulate nextTick to trigger evaluation or we can just call nextTick
    game.nextTick();

    expect(game.status).toBe(GameStatus.FINISHED);
    const result = game.checkGameEnd();
    expect(result).toEqual({ mode: GameMode.TURF_WAR, winnerTeamId: "t1" });
  });

  it("finishes game when max ticks reached and returns team with most land", () => {
    const grid = createGridForTurfWar();
    const game = new TurfWarGame(grid);
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const c0 = grid.get({ x: 0, y: 0 })!;
    const c1 = grid.get({ x: 1, y: 0 })!;
    const c2 = grid.get({ x: 2, y: 0 })!;

    c0.owner = p1;
    c1.owner = p2;
    c2.owner = p1; // p1 has 2 tiles, p2 has 1

    game.startGame();

    // Fast forward to MAX_TICKS
    // @ts-expect-error - bypassing private modifier
    game.tick = game.maxTicks - 1;
    game.nextTick();

    expect(game.status).toBe(GameStatus.FINISHED);
    const result = game.checkGameEnd();
    expect(result).toEqual({ mode: GameMode.TURF_WAR, winnerTeamId: "t1" });
  });

  describe("getScoreboard", () => {
    it("returns team landPercent and playerIds", () => {
      const grid = new Grid(4, 1, [
        [
          new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.GENERAL }),
          new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.PLAIN }),
          new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.MOUNTAIN }),
          new Cell({ coordinate: { x: 3, y: 0 }, terrain: Terrain.GENERAL }),
        ],
      ]);
      const game = new TurfWarGame(grid);
      const t1 = new StandardTeam("t1");
      const t2 = new StandardTeam("t2");
      const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
      const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
      t1.addPlayer(p1);
      t2.addPlayer(p2);
      game.teams.set("t1", t1);
      game.teams.set("t2", t2);
      game.players.set(p1.playerId, p1);
      game.players.set(p2.playerId, p2);

      grid.get({ x: 0, y: 0 })!.owner = p1;
      grid.get({ x: 1, y: 0 })!.owner = p1;
      grid.get({ x: 3, y: 0 })!.owner = p2;

      game.startGame();

      const scoreboard = game.getScoreboard();
      // 3 capturable tiles (excludes MOUNTAIN at x:2), t1 owns 2 → 67%, t2 owns 1 → 33%
      const t1Entry = scoreboard.teams.find((t) => t.teamId === "t1")!;
      const t2Entry = scoreboard.teams.find((t) => t.teamId === "t2")!;

      expect(t1Entry.playerIds).toEqual(["p1"]);
      expect(t1Entry.landPercent).toBe(67);
      expect(t2Entry.playerIds).toEqual(["p2"]);
      expect(t2Entry.landPercent).toBe(33);
    });
  });

  it("uses custom finishTick from options", () => {
    const grid = createGridForTurfWar();
    const game = new TurfWarGame(grid, { finishTick: 100 });
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    grid.get({ x: 0, y: 0 })!.owner = p1;
    grid.get({ x: 1, y: 0 })!.owner = p2;

    game.startGame();

    // Game should still be playing at tick 99
    game.tick = 98;
    game.nextTick();
    expect(game.status).toBe(GameStatus.PLAYING);

    // Game should finish at tick 100
    // @ts-expect-error - bypassing private modifier
    game.tick = game.maxTicks - 1;
    game.nextTick();
    expect(game.status).toBe(GameStatus.FINISHED);
  });

  it("integrates with RespawningCombatResolver during action execution", () => {
    const grid = createGridForTurfWar();
    const game = new TurfWarGame(grid);
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const c0 = grid.get({ x: 0, y: 0 })!;
    const c1 = grid.get({ x: 1, y: 0 })!;
    const c2 = grid.get({ x: 2, y: 0 })!;

    c0.owner = p1;
    c0.troopCount = 10;

    c1.owner = p2;
    c1.troopCount = 2;

    // Give p2 another tile so they respawn
    c2.owner = p2;
    c2.troopCount = 5;

    game.startGame();

    // p1 attacks p2's general
    const success = game.handleAction(createMoveAction("p1"));

    expect(success).toBe(true);

    // Attack succeeded, p1 owns c1 and it became a CITY
    expect(c1.owner).toBe(p1);
    expect(c1.terrain).toBe(Terrain.CITY);

    // p2 respawns general on c2
    expect(c2.owner).toBe(p2);
    expect(c2.terrain).toBe(Terrain.GENERAL);
    expect(p2.status).toBe(PlayerStatus.ACTIVE);

    // Game should still be playing
    expect(game.status).toBe(GameStatus.PLAYING);
  });
});
