import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import { Player } from "#/domain/player/player";
import { StandardTeam } from "#/domain/team/team";
import { Visibility } from "#/domain/vision/visibility";
import {
  createVisionCell,
  VisibilityMap,
} from "#/domain/vision/visibility-map";
import { MaskedTerrain } from "#/domain/vision/vision-grid";

function createVisionGrid(): Grid {
  const terrains = [
    [Terrain.PLAIN, Terrain.MOUNTAIN, Terrain.PLAIN],
    [Terrain.CITY, Terrain.GENERAL, Terrain.DESERT],
    [Terrain.PLAIN, Terrain.PLAIN, Terrain.SWAMP],
  ];
  const cells = terrains.map((row, y) =>
    row.map(
      (terrain, x) =>
        new Cell({
          coordinate: { x, y },
          terrain,
          troopCount: x + y + 1,
        }),
    ),
  );
  return new SquareGrid(3, 3, cells);
}

describe("VisibilityMap", () => {
  it("createVisionCell handles all four visibility states", () => {
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    const cell = new Cell({
      coordinate: { x: 1, y: 1 },
      terrain: Terrain.CITY,
      troopCount: 7,
    });
    cell.owner = player;

    const visible = createVisionCell(cell, Visibility.VISIBLE);
    expect(visible.visibility).toBe(Visibility.VISIBLE);
    expect(visible.terrain).toBe(Terrain.CITY);
    expect(visible.troopCount).toBe(7);
    expect(visible.owner?.playerId).toBe("p1");

    const terrainOnly = createVisionCell(cell, Visibility.TERRAIN);
    expect(terrainOnly.visibility).toBe(Visibility.TERRAIN);
    expect(terrainOnly.terrain).toBe(Terrain.CITY);
    expect(terrainOnly.troopCount).toBeNull();
    expect(terrainOnly.owner).toBeNull();

    const shrouded = createVisionCell(cell, Visibility.SHROUDED);
    expect(shrouded.visibility).toBe(Visibility.SHROUDED);
    expect(shrouded.terrain).toBe(MaskedTerrain.MAYBE_MOUNTAIN);
    expect(shrouded.troopCount).toBeNull();
    expect(shrouded.owner).toBeNull();

    const hidden = createVisionCell(cell, Visibility.HIDDEN);
    expect(hidden.visibility).toBe(Visibility.HIDDEN);
    expect(hidden.terrain).toBeNull();
    expect(hidden.troopCount).toBeNull();
    expect(hidden.owner).toBeNull();
  });

  it("renders shrouded generals as empty unknown terrain", () => {
    const cell = new Cell({
      coordinate: { x: 1, y: 1 },
      terrain: Terrain.GENERAL,
      troopCount: 7,
    });

    const shrouded = createVisionCell(cell, Visibility.SHROUDED);

    expect(shrouded.visibility).toBe(Visibility.SHROUDED);
    expect(shrouded.terrain).toBe(MaskedTerrain.MAYBE_PLAIN);
    expect(shrouded.troopCount).toBeNull();
    expect(shrouded.owner).toBeNull();
  });

  it("marks cells visible around owned cells using vision radius", () => {
    const grid = createVisionGrid();
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    team.addPlayer(player);

    const center = grid.get({ x: 1, y: 1 });
    if (!center) {
      throw new Error("center should exist");
    }
    center.owner = player;
    center.vision = { radius: 1 };

    const vision = new VisibilityMap(grid).evaluate(team);
    expect(vision.get({ x: 0, y: 0 })?.visibility).toBe(Visibility.VISIBLE);
    expect(vision.get({ x: 2, y: 2 })?.visibility).toBe(Visibility.VISIBLE);
    expect(vision.get({ x: 1, y: 1 })?.terrain).toBe(Terrain.GENERAL);
    expect(vision.get({ x: 1, y: 1 })?.troopCount).toBe(center.troopCount);
    expect(vision.get({ x: 1, y: 1 })?.owner?.playerId).toBe("p1");
  });

  it("shrouds non-visible cells and masks terrain", () => {
    const grid = createVisionGrid();
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    team.addPlayer(player);

    const center = grid.get({ x: 1, y: 1 });
    if (!center) {
      throw new Error("center should exist");
    }
    center.owner = player;
    center.vision = { radius: 0 };

    const vision = new VisibilityMap(grid).evaluate(team);
    const shroudedMountain = vision.get({ x: 1, y: 0 });
    const shroudedPlain = vision.get({ x: 0, y: 0 });

    expect(shroudedMountain?.visibility).toBe(Visibility.SHROUDED);
    expect(shroudedMountain?.terrain).toBe(MaskedTerrain.MAYBE_MOUNTAIN);
    expect(shroudedMountain?.troopCount).toBeNull();
    expect(shroudedMountain?.owner).toBeNull();

    expect(shroudedPlain?.terrain).toBe(MaskedTerrain.MAYBE_PLAIN);
  });

  it("returns fully shrouded grid when team controls no cells", () => {
    const grid = createVisionGrid();
    const team = new StandardTeam("t1");

    const vision = new VisibilityMap(grid).evaluate(team);

    expect(vision.get({ x: 1, y: 1 })?.visibility).toBe(Visibility.SHROUDED);
    expect(vision.get({ x: 1, y: 1 })?.troopCount).toBeNull();
    expect(vision.get({ x: 1, y: 1 })?.owner).toBeNull();
  });

  it("only emits visible or shrouded visibility values", () => {
    const grid = createVisionGrid();
    const team = new StandardTeam("t1");
    const player = new Player(team, "p1");
    team.addPlayer(player);

    const center = grid.get({ x: 1, y: 1 });
    if (!center) {
      throw new Error("center should exist");
    }
    center.owner = player;
    center.vision = { radius: 1 };

    const vision = new VisibilityMap(grid).evaluate(team);
    vision.forEach((cell) => {
      expect([Visibility.VISIBLE, Visibility.SHROUDED]).toContain(
        cell.visibility,
      );
    });
  });
});
