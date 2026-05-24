import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { PlayerStatus } from "#/domain/player/player-status";

describe("Cell", () => {
  it("applies expected defaults for a passable cell", () => {
    const cell = new Cell({
      coordinate: { x: 2, y: 3 },
      terrain: Terrain.PLAIN,
    });

    expect(cell.isPassable).toBe(true);
    expect(cell.owner).toBeNull();
    expect(cell.troopCount).toBeNull();
    expect(cell.vision).toEqual({ radius: 1 });
  });

  it("forces impassable cells to null troops", () => {
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
    expect(mountain.troopCount).toBeNull();
    expect(voidCell.isPassable).toBe(false);
    expect(voidCell.troopCount).toBeNull();
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
    expect(cell.troopCount).toBeNull();
  });

  it("updates properties correctly when terrain changes", () => {
    const cell = new Cell({
      coordinate: { x: 0, y: 0 },
      terrain: Terrain.PLAIN,
    });
    cell.troopCount = 10;
    cell.owner = { playerId: "player1", status: PlayerStatus.ACTIVE };

    // Change to impassable
    cell.terrain = Terrain.MOUNTAIN;
    expect(cell.isPassable).toBe(false);
    expect(cell.troopCount).toBeNull();
    expect(cell.owner).toBeNull();

    // Change back to passable
    cell.terrain = Terrain.PLAIN;
    expect(cell.isPassable).toBe(true);
    expect(cell.troopCount).toBeNull(); // Should keep null since it became null
    expect(cell.owner).toBeNull();
  });
});
