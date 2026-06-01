import { describe, expect, it } from "vitest";

import { Terrain } from "#/domain/cell/terrain";
import type { GridGeneratorOptions } from "#/domain/grid/grid-generator";
import {
  DefaultGenOptions,
  DefaultGridBounds,
  SquareGridGenerator,
} from "#/domain/grid/grid-generator";
import type { ICoordinate } from "#/math/coordinate";

// ── Helpers ──────────────────────────────────────────────────────────

import {
  GENERAL_SAFE_RADIUS,
  MIN_CITY_GENERAL_DISTANCE,
  MIN_FLAG_GENERAL_DISTANCE,
  MIN_FLAG_SPACING,
} from "#/domain/grid/grid-generator";
import { GridType } from "#/math/grid-2d";

function collectByTerrain(
  grid: ReturnType<SquareGridGenerator["generate"]>,
  terrain: string,
): ICoordinate[] {
  const result: ICoordinate[] = [];
  grid.forEach((cell) => {
    if (cell.terrain === terrain) {
      result.push(cell.coordinate);
    }
  });
  return result;
}

function toTerrainMatrix(
  grid: ReturnType<SquareGridGenerator["generate"]>,
): string[][] {
  return Array.from({ length: grid.height }, (_, y) =>
    Array.from(
      { length: grid.width },
      (_, x) => grid.get({ x, y })?.terrain ?? "missing",
    ),
  );
}

function manhattanDistance(a: ICoordinate, b: ICoordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function bfsReachable(
  grid: ReturnType<SquareGridGenerator["generate"]>,
  start: ICoordinate,
): number {
  const visited = new Set<string>();
  const queue: ICoordinate[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const cell = grid.get({ x: nx, y: ny });
      if (cell && cell.terrain !== Terrain.MOUNTAIN) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return visited.size;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("SquareGridGenerator", () => {
  const generator = new SquareGridGenerator();

  it("uses default dimensions when options are not provided", () => {
    const grid = generator.generate();
    expect(grid.width).toBe(DefaultGridBounds[GridType.SQUARE].width);
    expect(grid.height).toBe(DefaultGridBounds[GridType.SQUARE].height);
    let mountainCount = 0;
    let cityCount = 0;
    let generalCount = 0;
    grid.forEach((cell) => {
      if (cell.terrain === Terrain.MOUNTAIN) mountainCount++;
      else if (cell.terrain === Terrain.CITY) cityCount++;
      else if (cell.terrain === Terrain.GENERAL) generalCount++;
    });
    const totalCells = grid.width * grid.height;
    expect(mountainCount / totalCells).toBeCloseTo(
      DefaultGenOptions.mountainRate,
      1,
    );
    expect(cityCount / totalCells).toBeCloseTo(DefaultGenOptions.cityRate, 1);
    expect(generalCount).toBe(DefaultGenOptions.generalCount);
  });

  it("produces deterministic terrain for the same seed and options", () => {
    const options = { width: 16, height: 12, seed: 42 };
    const a = generator.generate(options);
    const b = generator.generate(options);
    expect(toTerrainMatrix(a)).toEqual(toTerrainMatrix(b));
  });

  it("produces different terrain for different seeds", () => {
    const base = { width: 16, height: 12 };
    const a = toTerrainMatrix(generator.generate({ ...base, seed: 1 }));
    const b = toTerrainMatrix(generator.generate({ ...base, seed: 9999 }));
    expect(a).not.toEqual(b);
  });

  it("places the correct number of generals with initial troops", () => {
    const grid = generator.generate({
      gridBounds: { width: 16, height: 12 },
      seed: 100,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);
    expect(generals).toHaveLength(DefaultGenOptions.generalCount);
    for (const g of generals) {
      expect(grid.get(g)?.troopCount).toBe(
        DefaultGenOptions.generalInitialTroops,
      );
    }
  });

  it("keeps the general safe zone free of mountains and cities", () => {
    const grid = generator.generate({
      gridBounds: { width: 20, height: 14 },
      seed: 777,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);

    for (const g of generals) {
      grid.forEachInRadius(g, GENERAL_SAFE_RADIUS, (cell) => {
        expect(cell.terrain).not.toBe(Terrain.MOUNTAIN);
        expect(cell.terrain).not.toBe(Terrain.CITY);
      });
    }
  });

  it("ensures all generals satisfy minimum pairwise distance", () => {
    const width = 20;
    const height = 14;
    const grid = generator.generate({
      gridBounds: { width, height },
      seed: 555,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);
    const minDist = Math.floor(
      Math.min(width, height) * DefaultGenOptions.minGeneralDistanceFactor,
    );

    for (let i = 0; i < generals.length; i++) {
      for (let j = i + 1; j < generals.length; j++) {
        expect(
          manhattanDistance(generals[i], generals[j]),
        ).toBeGreaterThanOrEqual(minDist);
      }
    }
  });

  it("ensures all generals are connected via non-mountain path", () => {
    const grid = generator.generate({
      gridBounds: { width: 20, height: 14 },
      seed: 321,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);
    const _reachableFromFirst = bfsReachable(grid, generals[0]);

    // All generals should be in the same connected component,
    // verified indirectly: BFS from first general should reach enough cells
    // that all generals are included.
    for (const g of generals) {
      // If g is reachable, BFS from g would find first general too.
      // Direct check: BFS from first includes g's position.
      const visited = new Set<string>();
      const queue: ICoordinate[] = [generals[0]];
      visited.add(`${generals[0].x},${generals[0].y}`);
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          const cell = grid.get({ x: nx, y: ny });
          if (cell && cell.terrain !== Terrain.MOUNTAIN) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
      expect(visited.has(`${g.x},${g.y}`)).toBe(true);
    }
  });

  it("keeps cities away from generals", () => {
    const grid = generator.generate({
      gridBounds: { width: 20, height: 14 },
      seed: 456,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);
    const cities = collectByTerrain(grid, Terrain.CITY);

    for (const c of cities) {
      for (const g of generals) {
        expect(manhattanDistance(c, g)).toBeGreaterThanOrEqual(
          MIN_CITY_GENERAL_DISTANCE,
        );
      }
    }
  });

  it("supports multi-player (4 generals) generation", () => {
    const grid = generator.generate({
      gridBounds: { width: 24, height: 16 },
      seed: 2026,
      generalCount: 4,
    });
    const generals = collectByTerrain(grid, Terrain.GENERAL);
    expect(generals).toHaveLength(4);

    // All generals should be connected
    const visited = new Set<string>();
    const queue: ICoordinate[] = [generals[0]];
    visited.add(`${generals[0].x},${generals[0].y}`);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        const cell = grid.get({ x: nx, y: ny });
        if (cell && cell.terrain !== Terrain.MOUNTAIN) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    for (const g of generals) {
      expect(visited.has(`${g.x},${g.y}`)).toBe(true);
    }
  });

  it("throws on invalid dimensions", () => {
    expect(() =>
      generator.generate({ gridBounds: { width: 3, height: 3 } }),
    ).toThrow(/dimensions/i);
  });

  it("throws on invalid rates", () => {
    expect(() => generator.generate({ mountainRate: -0.1 })).toThrow(/rate/i);
    expect(() => generator.generate({ cityRate: 1.5 })).toThrow(/rate/i);
  });

  it("handles high mountain rate without crashing", () => {
    // With very high mountain rate, generator may retry but should still produce
    // a valid map or throw a clear error.
    expect(() =>
      generator.generate({
        gridBounds: { width: 16, height: 12 },
        seed: 42,
        mountainRate: 0.4,
        cityRate: 0.02,
      }),
    ).not.toThrow();
  });

  describe("flag placement", () => {
    const flagOptions: GridGeneratorOptions<typeof GridType.SQUARE> = {
      gridBounds: { width: 20, height: 14 },
      seed: 1234,
      flagCount: 3,
      generalCount: 4,
    };

    it("places the requested number of flags", () => {
      const grid = generator.generate(flagOptions);
      const flags = collectByTerrain(grid, Terrain.FLAG);
      expect(flags).toHaveLength(3);
    });

    it("keeps flags away from generals", () => {
      const grid = generator.generate(flagOptions);
      const flags = collectByTerrain(grid, Terrain.FLAG);
      const generals = collectByTerrain(grid, Terrain.GENERAL);

      for (const f of flags) {
        for (const g of generals) {
          expect(manhattanDistance(f, g)).toBeGreaterThanOrEqual(
            MIN_FLAG_GENERAL_DISTANCE,
          );
        }
      }
    });

    it("enforces minimum spacing between flags", () => {
      const grid = generator.generate(flagOptions);
      const flags = collectByTerrain(grid, Terrain.FLAG);

      for (let i = 0; i < flags.length; i++) {
        for (let j = i + 1; j < flags.length; j++) {
          expect(manhattanDistance(flags[i], flags[j])).toBeGreaterThanOrEqual(
            MIN_FLAG_SPACING,
          );
        }
      }
    });

    it("biases flags toward the center of the map", () => {
      const width = 20;
      const height = 14;
      const cx = (width - 1) / 2;
      const cy = (height - 1) / 2;

      // Run many seeds and collect all flag positions
      const allFlags: ICoordinate[] = [];
      for (let seed = 0; seed < 50; seed++) {
        const grid = generator.generate({
          ...flagOptions,
          gridBounds: { width, height },
          seed,
        });
        allFlags.push(...collectByTerrain(grid, Terrain.FLAG));
      }

      // Average distance of flags from center should be less than
      // the average distance of all cells from center (random uniform)
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      const avgFlagDist =
        allFlags.reduce(
          (sum, f) => sum + Math.sqrt((f.x - cx) ** 2 + (f.y - cy) ** 2),
          0,
        ) / allFlags.length;

      expect(avgFlagDist).toBeLessThan(maxDist * 0.7);
    });

    it("generates zero flags when flagCount is not provided", () => {
      const grid = generator.generate({
        gridBounds: { width: 20, height: 14 },
        seed: 99,
        generalCount: 2,
      });
      const flags = collectByTerrain(grid, Terrain.FLAG);
      expect(flags).toHaveLength(0);
    });
  });

  describe("rugby generation", () => {
    it("generates goal zones and rugby spawn points at the center", () => {
      const grid = generator.generate({
        gridBounds: { width: 20, height: 14 },
        seed: 42,
        isRugby: true,
        generalCount: 2,
      });

      const goalZones = collectByTerrain(grid, Terrain.GOAL_ZONE);
      const rugbySpawns = collectByTerrain(grid, Terrain.RUGBY_SPAWN);

      // Goal zones should be generated
      expect(goalZones.length).toBeGreaterThan(0);

      // Rugby spawn points should be generated at the center (we expect exactly 4)
      expect(rugbySpawns.length).toBe(4);

      // Verify rugby spawn points are close to the center
      const cx = (grid.width - 1) / 2;
      const cy = (grid.height - 1) / 2;
      for (const spawn of rugbySpawns) {
        const dx = Math.abs(spawn.x - cx);
        const dy = Math.abs(spawn.y - cy);
        expect(dx).toBeLessThanOrEqual(2);
        expect(dy).toBeLessThanOrEqual(2);
      }
    });
  });
});
