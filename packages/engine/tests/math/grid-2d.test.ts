import { describe, expect, it } from "vitest";

import { isSameCoord } from "#/math/coordinate";
import { GridType, HexGrid2D, SquareGrid2D } from "#/math/grid-2d";

describe("SquareGrid2D", () => {
  const createSquareGrid = () =>
    new SquareGrid2D<number>(2, 2, [
      [1, 2],
      [3, 4],
    ]);

  it("initializes correctly and holds gridType", () => {
    const grid = createSquareGrid();
    expect(grid.gridType).toBe(GridType.SQUARE);
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
  });

  it("throws on invalid dimensions or mismatched data", () => {
    expect(
      () =>
        new SquareGrid2D(0, 2, [
          [1, 2],
          [3, 4],
        ]),
    ).toThrow("Grid dimensions must be positive.");
    expect(() => new SquareGrid2D(2, 2, [[1, 2]])).toThrow(
      "Grid data does not match the specified dimensions.",
    );
  });

  it("generates a grid using an initializer function", () => {
    const grid = SquareGrid2D.generate(2, 2, ({ x, y }) => `${x},${y}`);
    expect(grid.get({ x: 0, y: 0 })).toBe("0,0");
    expect(grid.get({ x: 1, y: 1 })).toBe("1,1");
  });

  it("creates a grid from a flat array", () => {
    const grid = SquareGrid2D.fromArray(
      2,
      2,
      [1, 2, 3, 4],
      (element, coordinate) => ({
        element,
        coordinate,
      }),
    );
    expect(grid.get({ x: 0, y: 0 })).toEqual({
      element: 1,
      coordinate: { x: 0, y: 0 },
    });
    expect(grid.get({ x: 1, y: 1 })).toEqual({
      element: 4,
      coordinate: { x: 1, y: 1 },
    });

    expect(() => SquareGrid2D.fromArray(2, 2, [1, 2, 3])).toThrow(
      "Array length does not match grid dimensions.",
    );
    expect(() => SquareGrid2D.fromArray(2, 2, [1, 2, 3, 4, 5])).toThrow(
      "Array length does not match grid dimensions.",
    );
  });

  it("counts the total number of cells correctly", () => {
    const grid = createSquareGrid();
    expect(grid.totalCells).toBe(4);
  });

  it("calculates the Cartesian coordinates correctly", () => {
    const grid = createSquareGrid();
    expect(grid.cartesianCenter).toEqual({ x: 0.5, y: 0.5 });

    expect(grid.toCartesian({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(grid.toCartesian({ x: 1, y: 1 })).toEqual({ x: 1, y: 1 });

    expect(grid.fromCartesian({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(grid.fromCartesian({ x: 0, y: 1.1 })).toEqual({ x: 0, y: 1 });
    expect(grid.fromCartesian({ x: 0.6, y: 0.9 })).toEqual({ x: 1, y: 1 });
    expect(grid.fromCartesian({ x: 1.4, y: 1.4 })).toEqual({ x: 1, y: 1 });
    expect(grid.fromCartesian({ x: -0.6, y: 0 })).toBeNull();
    expect(grid.fromCartesian({ x: 0, y: 1.5 })).toBeNull();
    expect(grid.fromCartesian({ x: 2, y: 0 })).toBeNull();
  });

  it("validates coordinates correctly", () => {
    const grid = createSquareGrid();
    expect(grid.isValid({ x: 0, y: 0 })).toBe(true);
    expect(grid.isValid({ x: 1, y: 1 })).toBe(true);
    expect(grid.isValid({ x: -1, y: 0 })).toBe(false);
    expect(grid.isValid({ x: 0, y: 2 })).toBe(false);
  });

  it("transforms coordinates to array indices correctly", () => {
    const grid = createSquareGrid();
    expect(grid.toArrayIndex({ x: 0, y: 0 })).toBe(0);
    expect(grid.toArrayIndex({ x: 1, y: 0 })).toBe(1);
    expect(grid.toArrayIndex({ x: 0, y: 1 })).toBe(2);
    expect(grid.toArrayIndex({ x: 1, y: 1 })).toBe(3);
    expect(grid.toArrayIndex({ x: -1, y: 0 })).toBe(-1); // Invalid coordinate
  });

  it("gets and sets values", () => {
    const grid = createSquareGrid();
    expect(grid.get({ x: 1, y: 0 })).toBe(2);
    expect(grid.get({ x: 5, y: 5 })).toBeNull();

    grid.set({ x: 1, y: 0 }, 99);
    expect(grid.get({ x: 1, y: 0 })).toBe(99);
  });

  it("calculates Manhattan distance correctly", () => {
    const grid = createSquareGrid();
    expect(grid.getDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(2);
    expect(grid.getDistance({ x: 0, y: 0 }, { x: 9, y: 9 })).toBe(Infinity); // Invalid coord
  });

  it("calculates the squared Euclidean distance to center correctly", () => {
    const grid = createSquareGrid();
    expect(grid.getDistanceToCenter({ x: 0, y: 0 })).toBeCloseTo(0.5);
    expect(grid.getDistanceToCenter({ x: 1, y: 1 })).toBeCloseTo(0.5);
    expect(grid.getDistanceToCenter({ x: 5, y: 5 })).toBe(Infinity); // Invalid coord
  });

  it("identifies adjacent cells", () => {
    const grid = createSquareGrid();
    expect(grid.isAdjacent({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
    expect(grid.isAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
  });

  it("returns correct neighbors bounded by the grid", () => {
    const grid = createSquareGrid();
    const neighbors = grid.getNeighbors({ x: 0, y: 0 }).map(([_, val]) => val);
    expect(neighbors).toEqual([2, 3]);
  });

  it("returns interior coordinates", () => {
    const grid = new SquareGrid2D<number>(3, 3, [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(grid.getInteriorCoordinates(1)).toEqual([{ x: 1, y: 1 }]);
    expect(grid.getInteriorCoordinates(2)).toEqual([]);
  });

  it("iterates over grid elements within a specified radius", () => {
    const grid = new SquareGrid2D<number>(3, 3, [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);

    let visited: number[] = [];
    grid.forEachInRadius({ x: 1, y: 1 }, 0, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([5]);

    visited = [];
    grid.forEachInRadius({ x: 1, y: 1 }, 1, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    visited = [];
    grid.forEachInRadius({ x: 2, y: 1 }, 1, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([2, 3, 5, 6, 8, 9]);
  });

  it("iterates and maps over grid elements", () => {
    const grid = createSquareGrid();
    const mapped = grid.map((val, _) => val * 10);

    expect(mapped.get({ x: 0, y: 0 })).toBe(10);
    expect(mapped.get({ x: 1, y: 1 })).toBe(40);

    const entries = Array.from(grid.entries());
    expect(entries).toHaveLength(4);
    expect(entries[0]).toEqual([{ x: 0, y: 0 }, 1]);
  });
});

describe("HexGrid2D", () => {
  // A small hex grid spanning:
  // y=0: x in [-1, 1] -> [1, 2, 3]
  // y=1: x in [-1, 1] -> [4, 5, 6]
  // y=2: x in [-1, 0] -> [7, 8]
  const createHexGrid = () =>
    new HexGrid2D<number>(2, 2, 3, 3, [
      [1, 2],
      [3, 4, 5],
      [6, 7],
    ]);

  it("initializes correctly and holds gridType", () => {
    const grid = createHexGrid();
    expect(grid.gridType).toBe(GridType.HEX);
    expect(grid.left).toBe(2);
    expect(grid.rightSlant).toBe(3);
  });

  it("throws on invalid dimensions or mismatched data", () => {
    expect(() => new HexGrid2D(0, 2, 3, 3, [])).toThrow(
      "Grid dimensions must be positive.",
    );
    expect(
      () =>
        new HexGrid2D(2, 2, 3, 3, [
          [1, 2],
          [3, 4],
          [6, 7],
        ]),
    ).toThrow("Grid data does not match the specified dimensions.");
  });

  it("generates a hex grid using an initializer function", () => {
    const grid = HexGrid2D.generate(2, 2, 3, 3, ({ x, y }) => `${x},${y}`);
    expect(grid.get({ x: 0, y: 0 })).toBe("0,0");
    expect(grid.get({ x: 1, y: 1 })).toBe("1,1");
    expect(grid.get({ x: -1, y: 2 })).toBe("-1,2");
  });

  it("creates a hex grid from a flat array", () => {
    const grid = HexGrid2D.fromArray(
      2,
      2,
      3,
      3,
      [1, 2, 3, 4, 5, 6, 7],
      (element, coordinate) => ({ element, coordinate }),
    );
    expect(grid.get({ x: 1, y: 0 })).toEqual({
      element: 2,
      coordinate: { x: 1, y: 0 },
    });
    expect(grid.get({ x: 1, y: 1 })).toEqual({
      element: 5,
      coordinate: { x: 1, y: 1 },
    });
    expect(grid.get({ x: -1, y: 2 })).toEqual({
      element: 6,
      coordinate: { x: -1, y: 2 },
    });

    expect(() => HexGrid2D.fromArray(2, 2, 3, 3, [1, 2])).toThrow(
      "Array length does not match grid dimensions.",
    );
    expect(() =>
      HexGrid2D.fromArray(2, 2, 3, 3, [1, 2, 3, 4, 5, 6, 7, 8]),
    ).toThrow("Array length does not match grid dimensions.");
  });

  it("counts the total number of hexes correctly", () => {
    const grid = createHexGrid();
    expect(grid.totalCells).toBe(7);
  });

  it("calculates the Cartesian coordinates correctly", () => {
    const grid = createHexGrid();
    expect(grid.cartesianCenter).toEqual({ x: 0, y: Math.sqrt(3) });

    expect(grid.toCartesian({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(grid.toCartesian({ x: 0, y: 2 })).toEqual({
      x: 0,
      y: 2 * Math.sqrt(3),
    });
    expect(grid.toCartesian({ x: 1, y: 0 })).toEqual({
      x: 1.5,
      y: Math.sqrt(3) / 2,
    });
    expect(grid.toCartesian({ x: -1, y: 2 })).toEqual({
      x: -1.5,
      y: 1.5 * Math.sqrt(3),
    });

    expect(grid.fromCartesian({ x: 0, y: Math.sqrt(3) / 2 - 0.1 })).toEqual({
      x: 0,
      y: 0,
    });
    expect(grid.fromCartesian({ x: 0, y: Math.sqrt(3) / 2 + 0.1 })).toEqual({
      x: 0,
      y: 1,
    });
    expect(grid.fromCartesian({ x: 0.75, y: Math.sqrt(3) * 1.25 })).toEqual({
      x: 1,
      y: 1,
    });
    expect(grid.fromCartesian({ x: 0.75, y: Math.sqrt(3) * 1.24 })).toEqual({
      x: 0,
      y: 1,
    });
    expect(grid.fromCartesian({ x: 0.74, y: Math.sqrt(3) * 1.25 })).toEqual({
      x: 0,
      y: 1,
    });
    expect(grid.fromCartesian({ x: -1, y: Math.sqrt(3) * 1.25 })).toEqual({
      x: -1,
      y: 2,
    });

    expect(grid.fromCartesian({ x: -0.5, y: -Math.sqrt(3) / 2 })).toBeNull();
    expect(grid.fromCartesian({ x: 0.76, y: -Math.sqrt(3) / 4 })).toBeNull();
    expect(grid.fromCartesian({ x: 2.1, y: 0 })).toBeNull();
    expect(grid.fromCartesian({ x: 2, y: Math.sqrt(3) * 2.1 })).toBeNull();
  });

  it("validates axial coordinates correctly", () => {
    const grid = createHexGrid();
    expect(grid.isValid({ x: 0, y: 0 })).toBe(true);
    expect(grid.isValid({ x: 1, y: 0 })).toBe(true);
    expect(grid.isValid({ x: 2, y: 0 })).toBe(false);
    expect(grid.isValid({ x: -1, y: 1 })).toBe(true);
    expect(grid.isValid({ x: 1, y: 1 })).toBe(true);
    expect(grid.isValid({ x: 2, y: 1 })).toBe(false);
    expect(grid.isValid({ x: -1, y: 2 })).toBe(true);
    expect(grid.isValid({ x: 0, y: 2 })).toBe(true);
    expect(grid.isValid({ x: 1, y: 2 })).toBe(false);
  });

  it("transforms axial coordinates to array indices correctly", () => {
    const grid = createHexGrid();
    expect(grid.toArrayIndex({ x: 0, y: 0 })).toBe(0);
    expect(grid.toArrayIndex({ x: 1, y: 0 })).toBe(1);
    expect(grid.toArrayIndex({ x: -1, y: 1 })).toBe(2);
    expect(grid.toArrayIndex({ x: 0, y: 1 })).toBe(3);
    expect(grid.toArrayIndex({ x: 1, y: 1 })).toBe(4);
    expect(grid.toArrayIndex({ x: -1, y: 2 })).toBe(5);
    expect(grid.toArrayIndex({ x: 0, y: 2 })).toBe(6);
    expect(grid.toArrayIndex({ x: 1, y: 2 })).toBe(-1); // Invalid coordinate
  });

  it("gets and sets values using internal offset indexing", () => {
    const grid = createHexGrid();

    // Correctly mapped axial to offset:
    expect(grid.get({ x: 1, y: 0 })).toBe(2);
    expect(grid.get({ x: -1, y: 1 })).toBe(3);
    expect(grid.get({ x: 0, y: 2 })).toBe(7);

    // Returns null for out-of-bounds coordinates
    expect(grid.get({ x: 1, y: 2 })).toBeNull();
    expect(grid.get({ x: 2, y: 0 })).toBeNull();

    // Successfully sets a value at a valid coordinate
    grid.set({ x: 0, y: 1 }, 99);
    expect(grid.get({ x: 0, y: 1 })).toBe(99);

    grid.set({ x: 1, y: 2 }, 88); // Invalid coordinate, should not set
    expect(grid.get({ x: 1, y: 2 })).toBeNull();
  });

  it("calculates axial hex distance correctly", () => {
    const grid = createHexGrid();

    expect(grid.getDistance({ x: 0, y: 1 }, { x: 0, y: 1 })).toBe(0);
    expect(grid.getDistance({ x: 0, y: 1 }, { x: 1, y: 0 })).toBe(1);
    expect(grid.getDistance({ x: -1, y: 1 }, { x: 0, y: 2 })).toBe(2);
    expect(grid.getDistance({ x: -1, y: 1 }, { x: 1, y: 1 })).toBe(2);

    // Returns Infinity for invalid coordinates
    expect(grid.getDistance({ x: 0, y: 1 }, { x: 2, y: 0 })).toBe(Infinity);
    expect(grid.getDistance({ x: -1, y: 0 }, { x: 1, y: 2 })).toBe(Infinity);
  });

  it("calculates the squared Euclidean distance to center correctly", () => {
    const grid = createHexGrid();
    expect(grid.getDistanceToCenter({ x: 0, y: 1 })).toBeCloseTo(0);
    expect(grid.getDistanceToCenter({ x: 1, y: 0 })).toBeCloseTo(3);
    expect(grid.getDistanceToCenter({ x: -1, y: 2 })).toBeCloseTo(3);
    expect(grid.getDistanceToCenter({ x: 1, y: 2 })).toBe(Infinity); // Invalid coordinate
  });

  it("returns correct hex neighbors bounded by the grid", () => {
    const grid = createHexGrid();
    expect(grid.getNeighbors({ x: 0, y: 1 }).map(([_, val]) => val)).toEqual([
      1, 2, 5, 7, 6, 3,
    ]); // All 6 neighbors exist
    expect(grid.getNeighbors({ x: 1, y: 0 }).map(([_, val]) => val)).toEqual([
      5, 4, 1,
    ]); // Missing 3 neighbors
  });

  it("returns interior coordinates", () => {
    const grid = createHexGrid();
    expect(grid.getInteriorCoordinates(1)).toEqual([{ x: 0, y: 1 }]);
    expect(grid.getInteriorCoordinates(2)).toEqual([]);
  });

  it("iterates over hex grid elements within a specified radius", () => {
    const grid1 = createHexGrid();

    let visited: number[] = [];
    grid1.forEachInRadius({ x: 0, y: 1 }, 0, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([4]);

    visited = [];
    grid1.forEachInRadius({ x: 0, y: 1 }, 1, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([1, 2, 3, 4, 5, 6, 7]);

    visited = [];
    grid1.forEachInRadius({ x: 1, y: 0 }, 1, (val) => {
      visited.push(val);
    });
    expect(visited).toEqual([1, 2, 4, 5]);

    const grid2 = HexGrid2D.generate(3, 3, 5, 5, () => false);
    grid2.forEachInRadius({ x: 0, y: 2 }, 1, (_, coord) => {
      grid2.set(coord, true);
    });

    expect(grid2.get({ x: 0, y: 2 })).toBe(true);
    expect(grid2.get({ x: -1, y: 2 })).toBe(true);
    expect(grid2.get({ x: 1, y: 2 })).toBe(true);
    expect(grid2.get({ x: 0, y: 1 })).toBe(true);
    expect(grid2.get({ x: 1, y: 1 })).toBe(true);
    expect(grid2.get({ x: -1, y: 3 })).toBe(true);
    expect(grid2.get({ x: 0, y: 3 })).toBe(true);

    expect(grid2.get({ x: -1, y: 1 })).toBe(false);
    expect(grid2.get({ x: 1, y: 3 })).toBe(false);
    expect(grid2.get({ x: 2, y: 2 })).toBe(false);
    expect(grid2.get({ x: -2, y: 2 })).toBe(false);
    expect(grid2.get({ x: 0, y: 0 })).toBe(false);
  });

  it("iterates and maps over hex grid elements", () => {
    const grid = createHexGrid();
    const mapped = grid.map((val) => val * 10);

    expect(mapped.get({ x: 0, y: 0 })).toBe(10);
    expect(mapped.get({ x: 0, y: 2 })).toBe(70);

    const entries = Array.from(grid.entries());
    expect(entries).toHaveLength(7);
    const [coord, element] = entries[0];
    expect(isSameCoord(coord, { x: 0, y: 0 })).toBe(true);
    expect(element).toBe(1); // Corresponding value
  });
});
