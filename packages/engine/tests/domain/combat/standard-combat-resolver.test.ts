import { describe, expect, it } from "vitest";

import { ActionType } from "../../../src/domain/action/action-type";
import type { IAction } from "../../../src/domain/action/interfaces";
import { Cell } from "../../../src/domain/cell/cell";
import { Terrain } from "../../../src/domain/cell/terrain";
import { StandardCombatResolver } from "../../../src/domain/combat/standard-combat-resolver";
import { Grid } from "../../../src/domain/grid/grid";
import { Player } from "../../../src/domain/player/player";
import { StandardTeam } from "../../../src/domain/team/team";

function createGrid(width = 2, height = 1): Grid {
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) =>
        new Cell({
          coordinate: { x, y },
          terrain: Terrain.PLAIN,
        }),
    ),
  );
  return new Grid(width, height, cells);
}

function createAction(type: IAction["type"] = ActionType.MOVE): IAction {
  return {
    playerId: "p1",
    type,
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
  };
}

describe("StandardCombatResolver", () => {
  it("returns false when source or target does not exist", () => {
    const resolver = new StandardCombatResolver();
    const grid = createGrid();
    const players = new Map();

    const result = resolver.execute(
      { ...createAction(), to: { x: 9, y: 9 } },
      grid,
      players,
    );

    expect(result).toBe(false);
  });

  it("returns false when source is not owned by action player", () => {
    const resolver = new StandardCombatResolver();
    const grid = createGrid();
    const source = grid.get({ x: 0, y: 0 });
    if (!source) {
      throw new Error("source should exist");
    }
    source.owner = { playerId: "other", status: "active" };
    source.troopCount = 10;

    const result = resolver.execute(createAction(), grid, new Map());

    expect(result).toBe(false);
  });

  it("returns false for impassable target, insufficient troops, or missing attacker", () => {
    const resolver = new StandardCombatResolver();
    const grid = createGrid();
    const source = grid.get({ x: 0, y: 0 });
    const target = grid.get({ x: 1, y: 0 });
    if (!source || !target) {
      throw new Error("cells should exist");
    }

    source.owner = { playerId: "p1", status: "active" };
    source.troopCount = 5;
    target.terrain = Terrain.MOUNTAIN;
    target.isPassable = false;
    expect(resolver.execute(createAction(), grid, new Map())).toBe(false);

    target.terrain = Terrain.PLAIN;
    target.isPassable = true;
    source.troopCount = 1;
    expect(resolver.execute(createAction(), grid, new Map())).toBe(false);

    source.troopCount = 5;
    expect(resolver.execute(createAction(), grid, new Map())).toBe(false);
  });

  it("reinforces allied target and updates ownership to attacker", () => {
    const resolver = new StandardCombatResolver();
    const grid = createGrid();
    const t1 = new StandardTeam("t1");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t1, "p2");
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const source = grid.get({ x: 0, y: 0 });
    const target = grid.get({ x: 1, y: 0 });
    if (!source || !target) {
      throw new Error("cells should exist");
    }

    source.owner = p1;
    source.troopCount = 10;
    target.owner = p2;
    target.troopCount = 3;

    const result = resolver.execute(createAction(), grid, players);

    expect(result).toBe(true);
    expect(source.troopCount).toBe(1);
    expect(target.owner).toBe(p1);
    expect(target.troopCount).toBe(12);
  });

  it("handles attack success, tie, fail and split move", () => {
    const resolver = new StandardCombatResolver();
    const t1 = new StandardTeam("t1");
    const t2 = new StandardTeam("t2");
    const p1 = new Player(t1, "p1");
    const p2 = new Player(t2, "p2");
    const players = new Map([
      ["p1", p1],
      ["p2", p2],
    ]);

    const grid1 = createGrid();
    const s1 = grid1.get({ x: 0, y: 0 });
    const d1 = grid1.get({ x: 1, y: 0 });
    if (!s1 || !d1) throw new Error("cells should exist");
    s1.owner = p1;
    s1.troopCount = 10;
    d1.owner = p2;
    d1.troopCount = 5;
    expect(resolver.execute(createAction(), grid1, players)).toBe(true);
    expect(d1.owner).toBe(p1);
    expect(d1.troopCount).toBe(4);

    const grid2 = createGrid();
    const s2 = grid2.get({ x: 0, y: 0 });
    const d2 = grid2.get({ x: 1, y: 0 });
    if (!s2 || !d2) throw new Error("cells should exist");
    s2.owner = p1;
    s2.troopCount = 5;
    d2.owner = p2;
    d2.troopCount = 4;
    expect(resolver.execute(createAction(), grid2, players)).toBe(true);
    expect(d2.owner).toBe(p2);
    expect(d2.troopCount).toBe(0);

    const grid3 = createGrid();
    const s3 = grid3.get({ x: 0, y: 0 });
    const d3 = grid3.get({ x: 1, y: 0 });
    if (!s3 || !d3) throw new Error("cells should exist");
    s3.owner = p1;
    s3.troopCount = 4;
    d3.owner = p2;
    d3.troopCount = 5;
    expect(resolver.execute(createAction(), grid3, players)).toBe(true);
    expect(d3.owner).toBe(p2);
    expect(d3.troopCount).toBe(2);

    const grid4 = createGrid();
    const s4 = grid4.get({ x: 0, y: 0 });
    const d4 = grid4.get({ x: 1, y: 0 });
    if (!s4 || !d4) throw new Error("cells should exist");
    s4.owner = p1;
    s4.troopCount = 9;
    d4.owner = p2;
    d4.troopCount = 1;
    expect(
      resolver.execute(createAction(ActionType.SPLIT_MOVE), grid4, players),
    ).toBe(true);
    expect(s4.troopCount).toBe(5);
    expect(d4.owner).toBe(p1);
    expect(d4.troopCount).toBe(3);
  });
});