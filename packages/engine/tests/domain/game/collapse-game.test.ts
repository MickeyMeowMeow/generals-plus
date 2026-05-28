import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { CollapseGame } from "#/domain/game/collapse-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function createGrid(width = 5, height = 5): Grid {
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(
        new Cell({
          coordinate: { x, y },
          terrain: Terrain.PLAIN,
        })
      );
    }
    cells.push(row);
  }
  return new SquareGrid(width, height, cells);
}

describe("CollapseGame", () => {
  it("initializes safe circle and next collapse tick correctly", () => {
    const grid = createGrid();
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 10, shrinkIntervalTicks: 5, collapseShape: "circle" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1");
    game.players.set(p1.playerId, p1);

    game.startGame();

    // Verify properties
    expect(game.mode).toBe(GameMode.COLLAPSE);
    const scoreboard = game.getScoreboard();
    expect(scoreboard.nextCollapseTick).toBe(10);
    expect(scoreboard.currentProgress).toBe(0);
  });

  it("calculates tick progress correctly", () => {
    const grid = createGrid();
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 10, shrinkIntervalTicks: 5, collapseShape: "circle" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const t2 = new StandardTeam("t2");
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Before startDelayTicks
    game.nextTick(); // tick 1
    expect(game.getScoreboard().currentProgress).toBeCloseTo(0.1);

    for (let i = 2; i <= 9; i++) {
      game.nextTick();
    }
    expect(game.getScoreboard().currentProgress).toBeCloseTo(0.9);

    // At tick 10 (triggers collapse & starts new cycle)
    game.nextTick();
    expect(game.getScoreboard().nextCollapseTick).toBe(15);
    expect(game.getScoreboard().currentProgress).toBeCloseTo(0.0);

    // After startDelayTicks
    game.nextTick(); // tick 11 (1/5 progress of shrink cycle)
    expect(game.getScoreboard().currentProgress).toBeCloseTo(0.2);
  });

  it("devours cells outside safe circle and relocates general", () => {
    // 3x3 grid: center at (1,1)
    const grid = createGrid(3, 3);
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 2, shrinkIntervalTicks: 2, collapseShape: "circle" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const t2 = new StandardTeam("t2");
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const cCenter = grid.get({ x: 1, y: 1 })!;
    const cCorner = grid.get({ x: 0, y: 0 })!;
    const cInside = grid.get({ x: 1, y: 0 })!;

    cCenter.terrain = Terrain.GENERAL;
    cCenter.owner = p1;
    cCenter.troopCount = 10;

    cCorner.owner = p1;
    cCorner.troopCount = 5;

    cInside.owner = p1;
    cInside.troopCount = 8;

    game.startGame();

    // Force shrink step to be 1.0, so the next circle has radius 0.5 (only covers (1,1))
    // We can directly mock/overwrite properties in the test
    (game as any).safeCircleRadius = 0.5;
    (game as any).nextSafeCircleCenterX = 1.0;
    (game as any).nextSafeCircleCenterY = 1.0;
    (game as any).nextSafeCircleRadius = 0.5;

    // Set willCollapse manually matching the mocked next circle
    game.grid.forEach((cell) => {
      cell.willCollapse = cell.coordinate.x !== 1 || cell.coordinate.y !== 1;
    });

    // Check cells that are marked as willCollapse
    game.grid.forEach((cell) => {
      const isCorner = cell.coordinate.x !== 1 || cell.coordinate.y !== 1;
      expect(cell.willCollapse).toBe(isCorner);
    });

    // Advance to tick 2 (collapse tick)
    game.nextTick(); // tick 1
    game.nextTick(); // tick 2: triggers collapse

    // Corner at (0,0) must be devoured (VOID, no owner, no troops)
    expect(cCorner.terrain).toBe(Terrain.VOID);
    expect(cCorner.owner).toBeNull();
    expect(cCorner.troopCount).toBeNull();
    expect(cCorner.isPassable).toBe(false);

    // Center at (1,1) is inside the circle so it remains intact and is still a GENERAL
    expect(cCenter.terrain).toBe(Terrain.GENERAL);
    expect(cCenter.owner).toBe(p1);
    expect(cCenter.troopCount).toBe(12);
  });

  it("successfully relocates general to owned cell inside safe circle", () => {
    // 3x3 grid: center at (1,1)
    const grid = createGrid(3, 3);
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 2, shrinkIntervalTicks: 2, collapseShape: "circle" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const t2 = new StandardTeam("t2");
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const cCenter = grid.get({ x: 1, y: 1 })!;
    const cInside = grid.get({ x: 1, y: 0 })!;
    const cDevoured = grid.get({ x: 0, y: 0 })!;

    // Set p1's general at (0,0) which will be devoured!
    cDevoured.terrain = Terrain.GENERAL;
    cDevoured.owner = p1;
    cDevoured.troopCount = 10;

    // Set p1's other owned cell at (1,0) inside the next circle
    cInside.owner = p1;
    cInside.troopCount = 5;

    game.startGame();

    // Shrink radius to cover center (1,1) and top-center (1,0), but exclude corner (0,0)
    // Distance from (1,1) to (0,0) is sqrt(2) ~ 1.41
    // Distance from (1,1) to (1,0) is 1.0
    // If center of next circle is (1,1) and radius is 1.2:
    (game as any).nextSafeCircleCenterX = 1.0;
    (game as any).nextSafeCircleCenterY = 1.0;
    (game as any).nextSafeCircleRadius = 1.2;

    // Advance to tick 2 (collapse)
    game.nextTick();
    game.nextTick();

    // Corner (0,0) devoured
    expect(cDevoured.terrain).toBe(Terrain.VOID);

    // General relocated to (1,0)
    expect(cInside.terrain).toBe(Terrain.GENERAL);
    expect(cInside.owner).toBe(p1);
    expect(cInside.troopCount).toBe(5);
  });

  it("eliminates player if no owned cells exist inside safe circle during collapse", () => {
    const grid = createGrid(3, 3);
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 2, shrinkIntervalTicks: 2, collapseShape: "circle" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const t2 = new StandardTeam("t2");
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    const cCenter = grid.get({ x: 1, y: 1 })!;
    const cInside = grid.get({ x: 1, y: 0 })!;
    const cCorner = grid.get({ x: 0, y: 0 })!;

    cCorner.terrain = Terrain.GENERAL;
    cCorner.owner = p1;
    cCorner.troopCount = 10;

    cCenter.owner = p2;
    cCenter.terrain = Terrain.GENERAL;

    game.startGame();

    // Shrink next circle so only p2's center is inside, and p1's corner is devoured
    (game as any).nextSafeCircleCenterX = 1.0;
    (game as any).nextSafeCircleCenterY = 1.0;
    (game as any).nextSafeCircleRadius = 0.5;

    // Advance to tick 2 (collapse)
    game.nextTick();
    game.nextTick();

    // Corner devoured
    expect(cCorner.terrain).toBe(Terrain.VOID);

    // P1 had no other tiles inside the circle, so P1 is eliminated
    expect(p1.status).toBe(PlayerStatus.ELIMINATED);
    expect(game.status).toBe(GameStatus.FINISHED);
  });

  it("supports square collapse shape correctly", () => {
    // 5x5 grid: center at (2,2)
    const grid = createGrid(5, 5);
    const game = new CollapseGame(
      { grid },
      { startDelayTicks: 2, shrinkIntervalTicks: 2, collapseShape: "square" }
    );

    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const t2 = new StandardTeam("t2");
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Overwrite safe zone to square centered at (2,2) with radius 1.2
    // Inside: (2,2), neighbors (2,1), (2,3), (1,2), (3,2), and diagonals (1,1), (3,3), etc.
    // In circular collapse, diagonals like (1,1) are at distance sqrt(2) ~ 1.41 > 1.2.
    // In square collapse, |x - cx| = 1.0 <= 1.2 and |y - cy| = 1.0 <= 1.2, so diagonals remain inside!
    (game as any).nextSafeCircleCenterX = 2.0;
    (game as any).nextSafeCircleCenterY = 2.0;
    (game as any).nextSafeCircleRadius = 1.2;

    const diagonalCell = grid.get({ x: 1, y: 1 })!;
    diagonalCell.owner = p1;

    game.nextTick();
    game.nextTick();

    // Under square shape, diagonal at (1,1) is INSIDE and remains plain/passable
    expect(diagonalCell.terrain).toBe(Terrain.PLAIN);
    expect(diagonalCell.owner).toBe(p1);
  });
});
