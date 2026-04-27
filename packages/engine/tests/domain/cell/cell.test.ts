import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";

describe("Cell", () => {
  it("applies expected defaults for a passable cell", () => {
    const cell = new Cell({
      coordinate: { x: 2, y: 3 },
      terrain: Terrain.PLAIN,
    });

    expect(cell.targetId).toBe("cell:2,3");
    expect(cell.isPassable).toBe(true);
    expect(cell.owner).toBeNull();
    expect(cell.troopCount).toBeNull();
    expect(cell.vision).toEqual({ radius: 1 });
  });

  it("forces impassable cells to zero troops", () => {
    const mountain = new Cell({
      coordinate: { x: 0, y: 0 },
      terrain: Terrain.MOUNTAIN,
      troopCount: 999,
    });
    const voidCell = new Cell({
      coordinate: { x: 1, y: 0 },
      terrain: Terrain.VOID,
      troopCount: 2,
    });

    expect(mountain.isPassable).toBe(false);
    expect(mountain.troopCount).toBe(0);
    expect(voidCell.isPassable).toBe(false);
    expect(voidCell.troopCount).toBe(0);
  });

  it("adds and removes troops while clamping at zero", () => {
    const cell = new Cell({
      coordinate: { x: 0, y: 0 },
      terrain: Terrain.PLAIN,
    });

    cell.addTroops(5);
    expect(cell.troopCount).toBe(5);

    cell.addTroops(-2);
    expect(cell.troopCount).toBe(3);

    cell.addTroops(-100);
    expect(cell.troopCount).toBe(0);
  });

  it("ignores troop updates on impassable terrain", () => {
    const cell = new Cell({
      coordinate: { x: 4, y: 4 },
      terrain: Terrain.MOUNTAIN,
    });

    cell.addTroops(10);
    expect(cell.troopCount).toBe(0);
  });
});
