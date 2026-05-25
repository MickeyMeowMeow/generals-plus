import { describe, expect, it } from "vitest";

import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { HexGrid, SquareGrid } from "#/domain/grid/grid";
import type { IGrid } from "#/domain/grid/interfaces";

/** Helper to create a standard test cell. */
function createCell(
  x: number,
  y: number,
  terrain: Terrain = Terrain.PLAIN,
): Cell {
  return new Cell({ coordinate: { x, y }, terrain });
}

describe("Game Grids", () => {
  /** Shared test suite for terrain indexing logic. */
  const testTerrainIndexing = (grid: IGrid, targetCell: Cell) => {
    it("initially indexes cells by terrain", () => {
      let found = false;
      grid.forEachTerrain(Terrain.PLAIN, (cell) => {
        if (cell === targetCell) found = true;
      });
      expect(found).toBe(true);
    });

    it("updates indexes when a cell's terrain type changes", () => {
      targetCell.terrain = Terrain.MOUNTAIN;

      let foundInOld = false;
      grid.forEachTerrain(Terrain.PLAIN, (cell) => {
        if (cell === targetCell) foundInOld = true;
      });

      let foundInNew = false;
      grid.forEachTerrain(Terrain.MOUNTAIN, (cell) => {
        if (cell === targetCell) foundInNew = true;
      });

      expect(foundInOld).toBe(false);
      expect(foundInNew).toBe(true);
    });
  };

  describe("SquareGrid", () => {
    const cell = createCell(0, 0);
    const grid = new SquareGrid(1, 1, [[cell]]);

    it("inherits mathematical validity from SquareGrid2D", () => {
      expect(grid.isValid({ x: 0, y: 0 })).toBe(true);
      expect(grid.isValid({ x: 1, y: 0 })).toBe(false);
    });

    testTerrainIndexing(grid, cell);
  });

  describe("HexGrid", () => {
    const cell = createCell(0, 0);
    const grid = new HexGrid(1, 1, 1, 1, [[cell]]);

    it("inherits mathematical validity from HexGrid2D", () => {
      expect(grid.isValid({ x: 0, y: 0 })).toBe(true);
      expect(grid.isValid({ x: -1, y: 0 })).toBe(false);
    });

    testTerrainIndexing(grid, cell);
  });
});
