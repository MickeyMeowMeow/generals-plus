import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { GameStatus } from "#/domain/game/game-status";
import { RugbyGame } from "#/domain/game/rugby-game";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { ItemType } from "#/domain/item/item-type";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function create9x5Grid(): Grid {
  const cells: Cell[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < 9; x++) {
      row.push(new Cell({ coordinate: { x, y }, terrain: Terrain.PLAIN }));
    }
    cells.push(row);
  }
  return new SquareGrid(9, 5, cells);
}

function getCell(grid: Grid, coord: { x: number; y: number }): Cell {
  const cell = grid.get(coord);
  if (!cell) {
    throw new Error(`Cell not found at ${coord.x}, ${coord.y}`);
  }
  return cell as Cell;
}

describe("RugbyGame", () => {
  it("initializes settings and spawns rugby ball near center", () => {
    const grid = create9x5Grid();
    const game = new RugbyGame(
      { grid },
      { rugbyBallCount: 1, rugbyMoveSpeedTicks: 3, rugbyWinningScore: 3 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    // Set generals to configure left vs right boundaries
    getCell(grid, { x: 1, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 1, y: 2 }).owner = p1;
    getCell(grid, { x: 7, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 7, y: 2 }).owner = p2;

    game.startGame();

    expect(game.leftTeamId).toBe("left-team");
    expect(game.rightTeamId).toBe("right-team");
    expect(game.rugbyBallCount).toBe(1);
    expect(game.rugbyMoveSpeedTicks).toBe(3);
    expect(game.winningScore).toBe(3);

    // Ball should spawn near center (4, 2)
    const centerCell = getCell(grid, { x: 4, y: 2 });
    expect(centerCell.item).not.toBeNull();
    expect(centerCell.item?.type).toBe(ItemType.RUGBY_BALL);
  });

  it("applies troop carrying movement cooldown speed limitations", () => {
    const grid = create9x5Grid();
    const game = new RugbyGame({ grid }, { rugbyMoveSpeedTicks: 3 });

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    getCell(grid, { x: 1, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 1, y: 2 }).owner = p1;
    getCell(grid, { x: 7, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 7, y: 2 }).owner = p2;

    game.startGame();

    // Give p1 some troops on (3, 2) and put rugby ball there
    const startCell = getCell(grid, { x: 3, y: 2 });
    startCell.owner = p1;
    startCell.troopCount = 20;

    // Move ball to (3, 2) manually for setup
    const centerCell = getCell(grid, { x: 4, y: 2 });
    const ball = centerCell.item;
    if (!ball) throw new Error("Ball not found");
    centerCell.item = null;
    startCell.item = ball;
    ball.coordinate = startCell.coordinate;

    // 1st move (pickup to adjacent plain): should succeed since last move tick is -1
    const targetCell1 = getCell(grid, { x: 2, y: 2 });
    targetCell1.owner = p1;
    targetCell1.troopCount = 2;

    const move1 = game.handleAction({
      playerId: "p1",
      type: ActionType.MOVE,
      from: startCell.coordinate,
      to: targetCell1.coordinate,
      troops: 10,
    });
    expect(move1).toBe(true);
    expect(targetCell1.item).toBe(ball);

    // 2nd move immediately: should fail due to cooldown (speed = 3 ticks, current tick = 0)
    const targetCell2 = getCell(grid, { x: 1, y: 2 });
    const move2 = game.handleAction({
      playerId: "p1",
      type: ActionType.MOVE,
      from: targetCell1.coordinate,
      to: targetCell2.coordinate,
      troops: 5,
    });
    expect(move2).toBe(false); // blocked by cooldown!

    // Advance 3 ticks
    game.nextTick(); // tick 1
    game.nextTick(); // tick 2
    game.nextTick(); // tick 3

    // 3rd move after 3 ticks: should succeed!
    const move3 = game.handleAction({
      playerId: "p1",
      type: ActionType.MOVE,
      from: targetCell1.coordinate,
      to: targetCell2.coordinate,
      troops: 5,
    });
    expect(move3).toBe(true);
    expect(targetCell2.item).toBe(ball);
  });

  it("scores touchdowns, increments score, and respawns ball", () => {
    const grid = create9x5Grid();
    const game = new RugbyGame({ grid }, { rugbyWinningScore: 2 });

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    getCell(grid, { x: 1, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 1, y: 2 }).owner = p1;
    getCell(grid, { x: 7, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 7, y: 2 }).owner = p2;

    // Define Left and Right Goal Zones
    // Left Team (left-team) scores in Right Goal (zoneIndex = 1)
    // Right Team (right-team) scores in Left Goal (zoneIndex = 0)
    const leftGoalCell = getCell(grid, { x: 0, y: 2 });
    leftGoalCell.terrain = Terrain.GOAL_ZONE;
    leftGoalCell.zoneIndex = 0;

    const rightGoalCell = getCell(grid, { x: 8, y: 2 });
    rightGoalCell.terrain = Terrain.GOAL_ZONE;
    rightGoalCell.zoneIndex = 1;

    game.startGame();

    // Prepare ball carrying troop for Left Team (p1) to Right Goal Zone (8, 2)
    const carryCell = getCell(grid, { x: 7, y: 2 });
    carryCell.owner = p1;
    carryCell.troopCount = 20;

    // Manually place the ball onto the carrying cell
    const centerCell = getCell(grid, { x: 4, y: 2 });
    const ball = centerCell.item;
    if (!ball) throw new Error("Ball not found");
    centerCell.item = null;
    carryCell.item = ball;
    ball.coordinate = carryCell.coordinate;

    // Set owner of goal cell to p1 so they can score
    rightGoalCell.owner = p1;
    rightGoalCell.troopCount = 0;

    // Move onto goal zone cell
    const scoreMove = game.handleAction({
      playerId: "p1",
      type: ActionType.MOVE,
      from: carryCell.coordinate,
      to: rightGoalCell.coordinate,
      troops: 10,
    });
    expect(scoreMove).toBe(true);

    // Touchdown scored!
    // Team score should increment, ball should be removed from goal cell and respawned near center
    expect(game.teamScores.get("left-team")).toBe(1);
    expect(rightGoalCell.item).toBeNull();

    // Ball respawned near center
    expect(centerCell.item).not.toBeNull();
    expect(centerCell.item?.type).toBe(ItemType.RUGBY_BALL);
  });

  it("evaluates game end on winning score target or timeout", () => {
    const grid = create9x5Grid();
    const game = new RugbyGame(
      { grid },
      { rugbyWinningScore: 1, finishTick: 10 },
    );

    const t1 = new StandardTeam("left-team");
    const t2 = new StandardTeam("right-team");
    const p1 = new Player(t1, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(t2, "p2", PlayerStatus.ACTIVE);
    game.teams.set(t1.teamId, t1);
    game.teams.set(t2.teamId, t2);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    getCell(grid, { x: 1, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 1, y: 2 }).owner = p1;
    getCell(grid, { x: 7, y: 2 }).terrain = Terrain.GENERAL;
    getCell(grid, { x: 7, y: 2 }).owner = p2;

    game.startGame();

    // Manually increment score for left-team to reach target (1)
    game.teamScores.set("left-team", 1);

    // Run evaluation
    const result = game.checkGameEnd();
    expect(result).not.toBeNull();
    expect(result?.winnerTeamId).toBe("left-team");
    expect(game.status).toBe(GameStatus.FINISHED);
  });
});
