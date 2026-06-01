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

    const bomb = game.bomb;
    expect(bomb).not.toBeNull();
    expect(bomb?.coordinate).toEqual(attackerGeneral?.coordinate);
    expect(attackerGeneral?.item).toBe(bomb);
  });

  it("updates planting progress when attacker-owned troops occupy bomb site with C4", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame(
      { grid },
      { bombSiteCount: 1, plantDurationTicks: 6 },
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

    // Move bomb from its current cell to the site cell
    const bomb = game.bomb;
    if (!bomb) throw new Error("bomb should exist");
    const currentBombCell = grid.get(bomb.coordinate);
    if (currentBombCell) currentBombCell.item = null;
    bomb.coordinate = siteCell.coordinate;
    siteCell.item = bomb;

    // If site cell is not owned by attacker, planting progress is 0
    game.nextTick();
    expect(game.plantProgressTicks).toBe(0);

    // Give site cell to attacker with troops
    siteCell.owner = p1;
    siteCell.troopCount = 10;

    // Plant duration is 6 ticks
    for (let i = 1; i <= 5; i++) {
      game.nextTick();
      expect(game.plantProgressTicks).toBe(i);
      expect(game.isPlanted).toBe(false);
    }

    game.nextTick();
    expect(game.isPlanted).toBe(true);
    expect(game.plantedAtSite).toBe("A");
    expect(game.detonationTick).toBe(game.tick + 90);
  });

  it("updates defusing progress when defender-owned troops occupy planted bomb site", () => {
    const grid = createPlainGrid5x5();
    const game = new DemolitionGame(
      { grid },
      { bombSiteCount: 1, defuseDurationTicks: 10 },
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

    const bomb = game.bomb;
    if (!bomb) throw new Error("bomb should exist");
    const currentBombCell = grid.get(bomb.coordinate);
    if (currentBombCell) currentBombCell.item = null;
    bomb.coordinate = siteCell.coordinate;
    siteCell.item = bomb;

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

    // Defuse duration is 10 ticks
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
    const bomb = game.bomb;
    if (!bomb) throw new Error("bomb should exist");

    // Move bomb to siteCell
    const currentBombCell = grid.get(bomb.coordinate);
    if (currentBombCell) currentBombCell.item = null;
    bomb.coordinate = siteCell.coordinate;
    siteCell.item = bomb;
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
    expect(siteCell.item).toBeNull();
    expect(adjCell.item).toBe(bomb);
    expect(bomb.coordinate).toEqual(adjCell.coordinate);

    // 2. After planting: carrying does NOT move the bomb
    adjCell.item = null;
    bomb.coordinate = siteCell.coordinate;
    siteCell.item = bomb;
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
    expect(siteCell.item).toBe(bomb);
    expect(adjCell.item).toBeNull();
    expect(bomb.coordinate).toEqual(siteCell.coordinate);
  });

  it("getVisionGrid includes bomb item for attacker player", () => {
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
    let cellsWithItem = 0;
    let bombFound = false;
    visionGrid?.forEach((cell) => {
      if (cell.item && cell.item.type === ItemType.BOMB) {
        cellsWithItem++;
        bombFound = true;
      }
    });

    expect(cellsWithItem).toBeGreaterThan(0);
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
    grid.forEach((c) => {
      if (c.terrain === Terrain.BOMB_SITE) {
        siteCell = c as Cell;
      }
    });
    if (!siteCell) throw new Error("siteCell should exist");

    let adjCell: Cell | null = null;
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
    const bomb = game.bomb;
    if (!bomb) throw new Error("bomb should exist");
    const currentBombCell = grid.get(bomb.coordinate);
    if (currentBombCell) currentBombCell.item = null;
    bomb.coordinate = siteCell.coordinate;
    siteCell.item = bomb;

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
    expect(siteCell.item).toBe(bomb);
    expect(adjCell.item).toBeNull();
    expect(bomb.coordinate).toEqual(siteCell.coordinate);
  });

  it("respawns general instead of instant elimination when a general is captured", () => {
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

    // Find the generals
    let p1Gen: Cell | null = null;
    let p2Gen: Cell | null = null;
    grid.forEach((c) => {
      if (c.terrain === Terrain.GENERAL) {
        if (c.owner?.playerId === "p1") p1Gen = c as Cell;
        if (c.owner?.playerId === "p2") p2Gen = c as Cell;
      }
    });

    expect(p1Gen).not.toBeNull();
    expect(p2Gen).not.toBeNull();
    if (!p1Gen || !p2Gen) throw new Error("Generals must exist");

    // Make p2 (defender) own an extra plain cell
    const p2Plain = grid.get({ x: 3, y: 3 }) as Cell;
    p2Plain.owner = p2;
    p2Plain.terrain = Terrain.PLAIN;

    // Position p1 troops next to p2's general
    const adjacentToP2Gen = grid.getNeighbors(p2Gen.coordinate)[0][0];
    const attackerCell = grid.get(adjacentToP2Gen) as Cell;
    attackerCell.owner = p1;
    attackerCell.troopCount = 20;

    p2Gen.troopCount = 5;

    // Attacker captures p2 general
    const success = game.handleAction({
      playerId: "p1",
      from: attackerCell.coordinate,
      to: p2Gen.coordinate,
      type: ActionType.MOVE,
    });
    expect(success).toBe(true);

    game.nextTick();

    // Captured general terrain should turn into PLAIN
    expect(p2Gen.terrain).toBe(Terrain.PLAIN);
    // Player p2 should still be active (respawned)
    expect(p2.status).toBe(PlayerStatus.ACTIVE);
    // The plain cell owned by p2 should be converted to GENERAL
    expect(p2Plain.terrain).toBe(Terrain.GENERAL);
  });
});
