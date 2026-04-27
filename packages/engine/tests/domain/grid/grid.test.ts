import { describe, expect, it } from "vitest";

import { Cell } from "../../../src/domain/cell/cell";
import { Terrain } from "../../../src/domain/cell/terrain";
import { Grid } from "../../../src/domain/grid/grid";

function createCell(x: number, y: number): Cell {
  return new Cell({
    coordinate: { x, y },
    terrain: Terrain.PLAIN,
  });
}

function createGrid(width = 3, height = 2): Grid {
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => createCell(x, y)),
  );
  return new Grid(width, height, cells);
}

describe("Grid", () => {
  it("rejects non-positive dimensions", () => {
    expect(() => new Grid(0, 1, [[createCell(0, 0)]])).toThrow(
      /dimensions must be positive/i,
    );
    expect(() => new Grid(1, -1, [[createCell(0, 0)]])).toThrow(
      /dimensions must be positive/i,
    );
  });

  it("rejects cell matrices that do not match dimensions", () => {
    const badRows = [[createCell(0, 0), createCell(1, 0)]];

    expect(() => new Grid(2, 2, badRows)).toThrow(/does not match/i);
  });

  it("gets cells only when coordinate is in bounds", () => {
    const grid = createGrid(2, 2);

    expect(grid.get({ x: 1, y: 1 })?.coordinate).toEqual({ x: 1, y: 1 });
    expect(grid.get({ x: -1, y: 0 })).toBeNull();
    expect(grid.get({ x: 2, y: 0 })).toBeNull();
    expect(grid.get({ x: 0, y: 2 })).toBeNull();
  });

  it("returns neighbors in N, E, S, W order when present", () => {
    const grid = createGrid(3, 3);

    const neighbors = grid.getNeighbors({ x: 1, y: 1 });
    const coordinates = neighbors.map((cell) => cell.coordinate);

    expect(coordinates).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
    ]);
  });

  it("omits out-of-bounds neighbors at edges", () => {
    const grid = createGrid(2, 2);

    const neighbors = grid.getNeighbors({ x: 0, y: 0 });
    const coordinates = neighbors.map((cell) => cell.coordinate);

    expect(coordinates).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it("iterates cells in row-major order", () => {
    const grid = createGrid(2, 2);
    const seen: Array<{
      coordinate: { x: number; y: number };
      x: number;
      y: number;
    }> = [];

    grid.forEach((cell, coordinate) => {
      seen.push({
        coordinate: cell.coordinate,
        x: coordinate.x,
        y: coordinate.y,
      });
    });

    expect(seen).toEqual([
      { coordinate: { x: 0, y: 0 }, x: 0, y: 0 },
      { coordinate: { x: 1, y: 0 }, x: 1, y: 0 },
      { coordinate: { x: 0, y: 1 }, x: 0, y: 1 },
      { coordinate: { x: 1, y: 1 }, x: 1, y: 1 },
    ]);
  });
});
