import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { DominationGame } from "#/domain/game/domination-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function createGridWithFlag(): Grid {
  return new SquareGrid(2, 1, [
    [
      new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.FLAG }),
      new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.PLAIN }),
    ],
  ]);
}

describe("DominationGame", () => {
  it("accumulates score for team holding a flag", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();

    expect(game.teamScores.get("t1")).toBe(0);

    game.nextTick();

    // Base score increment is 1 + floor(ticks / 100)
    // Ticks is 1 on first hold
    expect(game.teamScores.get("t1")).toBe(1);

    game.nextTick();
    expect(game.teamScores.get("t1")).toBe(2);
  });

  it("finishes game when target score is reached", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();

    // Fast forward until target score
    for (let i = 0; i < game.targetScore; i++) {
      game.nextTick();
    }

    expect(game.status).toBe(GameStatus.FINISHED);

    // Check if checkGameEnd returns the cached result after game ends
    const result = game.checkGameEnd();
    expect(result).toEqual({ mode: GameMode.DOMINATION, winnerTeamId: "t1" });
  });

  it("finishes game when max ticks reached and returns highest score team", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();

    // Give team 1 some points
    game.nextTick();
    game.nextTick();

    // Remove ownership
    flagCell.owner = null;

    // Fast forward to MAX_TICKS
    // @ts-expect-error - bypassing private modifier for testing
    game.tick = game.maxTicks - 1;
    game.nextTick();

    expect(game.status).toBe(GameStatus.FINISHED);
    const result = game.checkGameEnd();
    expect(result).toEqual({ mode: GameMode.DOMINATION, winnerTeamId: "t1" });
  });

  it("generates correct scoreboard including team scores", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();
    game.nextTick();

    const scoreboard = game.getScoreboard();

    expect(scoreboard.mode).toBe(GameMode.DOMINATION);
    expect(scoreboard.players).toContainEqual({
      playerId: "p1",
      troops: 0,
      land: 1,
      isAlive: true,
    });
    expect(scoreboard.teamScores.get("t1")).toBe(1);
  });

  it("uses default targetScore and finishTick when no options provided", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid });

    expect(game.targetScore).toBe(1000);
    // @ts-expect-error - bypassing private modifier
    expect(game.maxTicks).toBe(600);
  });

  it("accepts custom targetScore via options", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid }, { targetScore: 100 });

    expect(game.targetScore).toBe(100);
  });

  it("accepts custom finishTick via options", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid }, { finishTick: 200 });

    // @ts-expect-error - bypassing private modifier
    expect(game.maxTicks).toBe(200);
  });

  it("finishes game when custom targetScore is reached", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid }, { targetScore: 5 });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();

    for (let i = 0; i < 5; i++) {
      game.nextTick();
    }

    expect(game.status).toBe(GameStatus.FINISHED);
  });

  it("finishes game when custom finishTick is reached", () => {
    const grid = createGridWithFlag();
    const game = new DominationGame({ grid }, { finishTick: 3 });
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.players.set(p1.playerId, p1);

    const flagCell = grid.get({ x: 0, y: 0 });
    if (!flagCell) throw new Error("Missing flag cell");
    flagCell.owner = p1;

    game.startGame();

    game.nextTick();
    game.nextTick();
    game.nextTick();

    expect(game.status).toBe(GameStatus.FINISHED);
  });
});
