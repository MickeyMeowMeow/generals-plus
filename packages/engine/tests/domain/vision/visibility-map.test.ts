import { describe, expect, it } from "vitest";

import { Cell } from "../../../src/domain/cell/cell";
import { Terrain } from "../../../src/domain/cell/terrain";
import { Grid } from "../../../src/domain/grid/grid";
import { Player } from "../../../src/domain/player/player";
import { StandardTeam } from "../../../src/domain/team/team";
import { Visibility } from "../../../src/domain/vision/visibility";
import { VisibilityMap } from "../../../src/domain/vision/visibility-map";
import { MaskedTerrain } from "../../../src/domain/vision/vision-grid";

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
  return new Grid(3, 3, cells);
}

describe("VisibilityMap", () => {
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

  it("hides non-visible cells and masks terrain", () => {
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
    const hiddenMountain = vision.get({ x: 1, y: 0 });
    const hiddenPlain = vision.get({ x: 0, y: 0 });

    expect(hiddenMountain?.visibility).toBe(Visibility.HIDDEN);
    expect(hiddenMountain?.terrain).toBe(MaskedTerrain.MAYBE_MOUNTAIN);
    expect(hiddenMountain?.troopCount).toBeNull();
    expect(hiddenMountain?.owner).toBeNull();

    expect(hiddenPlain?.terrain).toBe(MaskedTerrain.MAYBE_PLAIN);
  });

  it("returns fully hidden grid when team controls no cells", () => {
    const grid = createVisionGrid();
    const team = new StandardTeam("t1");

    const vision = new VisibilityMap(grid).evaluate(team);

    expect(vision.get({ x: 1, y: 1 })?.visibility).toBe(Visibility.HIDDEN);
    expect(vision.get({ x: 1, y: 1 })?.troopCount).toBeNull();
    expect(vision.get({ x: 1, y: 1 })?.owner).toBeNull();
  });
});
