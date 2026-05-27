import { describe, expect, it } from "vitest";

import { ActionType } from "#/domain/action/action-type";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { DemolitionGame } from "#/domain/game/demolition-game";
import { GameMode } from "#/domain/game/game-mode";
import { GameStatus } from "#/domain/game/game-status";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { ItemType } from "#/domain/item/item-type";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { AttackerTeam, DefenderTeam } from "#/domain/team/team";

function createPlainGrid5x5(): Grid {
  const cells: Cell[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < 5; x++) {
      const terrain =
        (x === 0 && y === 0) || (x === 4 && y === 4)
          ? Terrain.GENERAL
          : Terrain.PLAIN;
      row.push(new Cell({ coordinate: { x, y }, terrain }));
    }
    cells.push(row);
  }
  return new SquareGrid(5, 5, cells);
}

describe("DemolitionGame", () => {
  it("initializes teams and assigns the bomb to a random attacker starting general", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid }, { bombSiteCount: 1, seed: 1234 });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Verify one plain was converted to BOMB_SITE
    let bombSiteCount = 0;
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        bombSiteCount++;
      }
    });
    expect(bombSiteCount).toBe(1);

    // Verify bomb is assigned to attackers general cell
    let attackerGeneral: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.GENERAL && c.owner?.playerId === "p1") {
        attackerGeneral = c as Cell;
      }
    });
    expect(attackerGeneral).not.toBeNull();

    const bomb = game.items.find((item) => item.type === ItemType.BOMB);
    expect(bomb).toBeDefined();
    expect(bomb?.coordinate).toEqual(attackerGeneral?.coordinate);
    expect(attackerGeneral?.items.length).toBe(1);
    expect(attackerGeneral?.items[0]).toBe(bomb);
  });

  it("updates planting progress when attacker-owned troops occupy bomb site with C4", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame(
      { grid },
      { bombSiteCount: 1, plantDuration: 3 },
    );

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Move bomb to the bomb site (let's find the bomb site cell)
    let siteCell: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        siteCell = c as Cell;
      }
    });
    expect(siteCell).not.toBeNull();
    if (!siteCell) throw new Error("siteCell should exist");

    // Clear initial cells' items and place bomb on site cell
    grid.forEach((c) => {
      c.items.length = 0;
    });
    const bomb = game.items.find((item) => item.type === ItemType.BOMB);
    if (!bomb) throw new Error("bomb should exist");
    bomb.coordinate = siteCell.coordinate;
    siteCell.items.push(bomb);

    // If site cell is not owned by attacker, planting progress is 0
    game.nextTick();
    expect(game.plantProgressTicks).toBe(0);

    // Give site cell to attacker with troops
    siteCell.owner = p1;
    siteCell.troopCount = 10;

    // Plant duration is 3 seconds -> 6 ticks at 500ms
    for (let i = 1; i <= 5; i++) {
      game.nextTick();
      expect(game.plantProgressTicks).toBe(i);
      expect(game.isPlanted).toBe(false);
    }

    game.nextTick();
    expect(game.isPlanted).toBe(true);
    expect(game.plantedAtSite).toBe("A"); // string letter based on siteIndex 0
    expect(game.detonationTick).toBe(game.tick + 90); // 45 seconds -> 90 ticks
  });

  it("updates defusing progress when defender-owned troops occupy planted bomb site", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame(
      { grid },
      { bombSiteCount: 1, defuseDuration: 5 },
    );

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Find bomb site and plant bomb
    let siteCell: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        siteCell = c as Cell;
      }
    });
    if (!siteCell) throw new Error("siteCell should exist");
    grid.forEach((c) => {
      c.items.length = 0;
    });
    const bomb = game.items.find((item) => item.type === ItemType.BOMB);
    if (!bomb) throw new Error("bomb should exist");
    bomb.coordinate = siteCell.coordinate;
    siteCell.items.push(bomb);

    // Force bomb planted
    game.isPlanted = true;
    game.plantedAtSite = "A";
    game.detonationTick = game.tick + 90;

    // If site cell is not owned by defender, defuse progress is 0
    game.nextTick();
    expect(game.defuseProgressTicks).toBe(0);

    // Give site cell to defender with troops
    siteCell.owner = p2;
    siteCell.troopCount = 5;

    // Defuse duration is 5 seconds -> 10 ticks
    for (let i = 1; i <= 9; i++) {
      game.nextTick();
      expect(game.defuseProgressTicks).toBe(i);
      expect(game.isDefused).toBe(false);
    }

    game.nextTick();
    expect(game.isDefused).toBe(true);
    expect(game.status).toBe(GameStatus.FINISHED);

    const result = game.checkGameEnd();
    expect(result).toEqual({
      mode: GameMode.DEMOLITION,
      winnerTeamId: "defenders",
    });
  });

  it("finishes game with attacker victory when bomb detonates", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid }, { bombSiteCount: 1 });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Force plant bomb
    game.isPlanted = true;
    game.plantedAtSite = "A";
    game.detonationTick = game.tick + 10;

    // Advance 9 ticks
    for (let i = 0; i < 9; i++) {
      game.nextTick();
      expect(game.status).toBe(GameStatus.PLAYING);
    }

    // 10th tick detonates C4
    game.nextTick();
    expect(game.status).toBe(GameStatus.FINISHED);

    const result = game.checkGameEnd();
    expect(result).toEqual({
      mode: GameMode.DEMOLITION,
      winnerTeamId: "attackers",
    });
  });

  it("finishes game with defender victory when timeout is reached", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid }, { finishTick: 20 });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Fast-forward to tick 20
    for (let i = 0; i < 20; i++) {
      game.nextTick();
    }

    expect(game.status).toBe(GameStatus.FINISHED);

    const result = game.checkGameEnd();
    expect(result).toEqual({
      mode: GameMode.DEMOLITION,
      winnerTeamId: "defenders",
    });
  });

  it("finishes game when a team is completely eliminated", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Eliminate p2 (defender)
    p2.status = PlayerStatus.ELIMINATED;

    // Check victory
    game.nextTick();
    expect(game.status).toBe(GameStatus.FINISHED);

    const result = game.checkGameEnd();
    expect(result).toEqual({
      mode: GameMode.DEMOLITION,
      winnerTeamId: "attackers",
    });
  });

  it("prevents carrying the bomb away from the site once it is successfully planted", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Find bomb site cell and another adjacent cell
    let siteCell: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        siteCell = c as Cell;
      }
    });
    expect(siteCell).not.toBeNull();
    if (!siteCell) throw new Error("siteCell should exist");

    const adjCoord = {
      x: siteCell.coordinate.x === 0 ? 1 : siteCell.coordinate.x - 1,
      y: siteCell.coordinate.y,
    };
    const adjCell = grid.get(adjCoord);
    if (!adjCell) throw new Error("adjCell should exist");

    // 1. Before planting: carrying works
    grid.forEach((c) => {
      c.items.length = 0;
    });
    const bomb = game.items.find((item) => item.type === ItemType.BOMB);
    if (!bomb) throw new Error("bomb should exist");
    bomb.coordinate = siteCell.coordinate;
    siteCell.items.push(bomb);
    siteCell.owner = p1;
    siteCell.troopCount = 10;

    // Move from siteCell to adjCell
    game.handleAction({
      playerId: "p1",
      from: siteCell.coordinate,
      to: adjCell.coordinate,
      type: ActionType.MOVE,
    });
    game.nextTick();

    // Bomb should be moved because it is not planted yet!
    expect(siteCell.items.length).toBe(0);
    expect(adjCell.items.length).toBe(1);
    expect(adjCell.items[0]).toBe(bomb);
    expect(bomb.coordinate).toEqual(adjCell.coordinate);

    // 2. After planting: carrying does NOT move the bomb
    grid.forEach((c) => {
      c.items.length = 0;
    });
    bomb.coordinate = siteCell.coordinate;
    siteCell.items.push(bomb);
    siteCell.owner = p1;
    siteCell.troopCount = 10;
    adjCell.owner = p1;
    adjCell.troopCount = 1;

    // Force bomb planted
    game.isPlanted = true;

    // Move from siteCell to adjCell
    game.handleAction({
      playerId: "p1",
      from: siteCell.coordinate,
      to: adjCell.coordinate,
      type: ActionType.MOVE,
    });
    game.nextTick();

    // Bomb should NOT be moved because it is planted!
    expect(siteCell.items.length).toBe(1);
    expect(siteCell.items[0]).toBe(bomb);
    expect(adjCell.items.length).toBe(0);
    expect(bomb.coordinate).toEqual(siteCell.coordinate);
  });

  it("getVisionGrid includes bomb items for attacker player", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid }, { bombSiteCount: 1, seed: 1234 });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Get vision grid for attacker
    const visionGrid = game.getVisionGrid("p1");
    expect(visionGrid).not.toBeNull();

    // Find cells with items in the vision grid
    let cellsWithItems = 0;
    let bombFound = false;
    visionGrid?.forEach((cell) => {
      if (cell.items && cell.items.length > 0) {
        cellsWithItems++;
        const hasBomb = cell.items.some((item) => item.type === ItemType.BOMB);
        if (hasBomb) bombFound = true;
      }
    });

    expect(cellsWithItems).toBeGreaterThan(0);
    expect(bombFound).toBe(true);
  });

  it("blocks defender players from carrying the C4 bomb", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame({ grid }, { bombSiteCount: 1 });

    const attackers = new AttackerTeam("attackers");
    const defenders = new DefenderTeam("defenders");
    const p1 = new Player(attackers, "p1", PlayerStatus.ACTIVE);
    const p2 = new Player(defenders, "p2", PlayerStatus.ACTIVE);

    game.teams.set(attackers.teamId, attackers);
    game.teams.set(defenders.teamId, defenders);
    game.players.set(p1.playerId, p1);
    game.players.set(p2.playerId, p2);

    game.startGame();

    // Find C4 bomb cell
    let siteCell: Cell | null = null;
    let adjCell: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        siteCell = c as Cell;
      }
    });
    if (!siteCell) throw new Error("siteCell should exist");

    const neighbors = grid.getNeighbors(siteCell.coordinate);
    for (const [coord] of neighbors) {
      const neighborCell = grid.get(coord);
      if (neighborCell && neighborCell.terrain === Terrain.PLAIN) {
        adjCell = neighborCell as Cell;
        break;
      }
    }
    if (!adjCell) throw new Error("adjCell should exist");

    // Place bomb on siteCell
    grid.forEach((c) => {
      c.items.length = 0;
    });
    const bomb = game.items.find((item) => item.type === ItemType.BOMB);
    if (!bomb) throw new Error("bomb should exist");
    bomb.coordinate = siteCell.coordinate;
    siteCell.items.push(bomb);

    // Give siteCell to defender with troops
    siteCell.owner = p2;
    siteCell.troopCount = 10;
    adjCell.owner = p2;
    adjCell.troopCount = 1;

    // Defender moves troops from siteCell to adjCell
    game.handleAction({
      playerId: "p2",
      from: siteCell.coordinate,
      to: adjCell.coordinate,
      type: ActionType.MOVE,
    });
    game.nextTick();

    // Bomb should NOT be moved because player is a defender!
    expect(siteCell.items.length).toBe(1);
    expect(siteCell.items[0]).toBe(bomb);
    expect(adjCell.items.length).toBe(0);
    expect(bomb.coordinate).toEqual(siteCell.coordinate);
  });
});
