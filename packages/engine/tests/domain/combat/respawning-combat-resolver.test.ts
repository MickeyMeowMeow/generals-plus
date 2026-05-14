import { describe, expect, it } from "vitest";

import type { MoveActionType } from "#/domain/action/action-type";
import { ActionType } from "#/domain/action/action-type";
import type { MoveAction } from "#/domain/action/interfaces";
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { RespawningCombatResolver } from "#/domain/combat/respawning-combat-resolver";
import { Grid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { PlayerStatus } from "#/domain/player/player-status";
import { StandardTeam } from "#/domain/team/team";

function createMoveAction(type: MoveActionType = ActionType.MOVE): MoveAction {
  return {
    playerId: "p1",
    type,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  };
}

describe("RespawningCombatResolver", () => {
  it("respawns general on remaining tile when general is captured", () => {
    const resolver = new RespawningCombatResolver();
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t2, "p2");
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const grid = new Grid(3, 1, [
      [
        new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
        new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.GENERAL }),
        new Cell({ coordinate: { x: 2, y: 0 }, terrain: Terrain.CITY }),
      ],
    ]);

    const source = grid.get({ x: 0, y: 0 });
    const general = grid.get({ x: 1, y: 0 });
    const resourceCell = grid.get({ x: 2, y: 0 });
    if (!source || !general || !resourceCell) {
      throw new Error("cells should exist");
    }

    source.owner = p1;
    source.troopCount = 10;
    general.owner = p2;
    general.troopCount = 3;
    resourceCell.owner = p2;
    resourceCell.troopCount = 8;

    const result = resolver.execute(createMoveAction(), grid, players);

    expect(result).toBe(true);
    // Attacker gets the general cell and it turns into a city
    expect(general.owner).toBe(p1);
    expect(general.terrain).toBe(Terrain.CITY);

    // Defender keeps their other cell and it becomes their new general
    expect(resourceCell.owner).toBe(p2);
    expect(resourceCell.troopCount).toBe(8);
    expect(resourceCell.terrain).toBe(Terrain.GENERAL);
    expect(p2.status).toBe(PlayerStatus.ACTIVE);
  });

  it("eliminates player when general is captured and they have no other tiles", () => {
    const resolver = new RespawningCombatResolver();
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t2, "p2");
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const grid = new Grid(2, 1, [
      [
        new Cell({ coordinate: { x: 0, y: 0 }, terrain: Terrain.PLAIN }),
        new Cell({ coordinate: { x: 1, y: 0 }, terrain: Terrain.GENERAL }),
      ],
    ]);

    const source = grid.get({ x: 0, y: 0 });
    const general = grid.get({ x: 1, y: 0 });
    if (!source || !general) {
      throw new Error("cells should exist");
    }

    source.owner = p1;
    source.troopCount = 10;
    general.owner = p2;
    general.troopCount = 3;

    const result = resolver.execute(createMoveAction(), grid, players);

    expect(result).toBe(true);
    // Attacker gets the general cell and it turns into a city
    expect(general.owner).toBe(p1);
    expect(general.terrain).toBe(Terrain.CITY);

    // Defender has no tiles left and is eliminated
    expect(p2.status).toBe(PlayerStatus.ELIMINATED);
  });
});
