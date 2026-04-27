import { describe, expect, it } from "vitest";

import { Terrain } from "../../../src/domain/cell/terrain";
import {
  DefaultGridGenerator,
  DefaultGridGeneratorOptions,
} from "../../../src/domain/grid/grid-generator";

function toTerrainMatrix(
  grid: ReturnType<DefaultGridGenerator["generate"]>,
): string[][] {
  return Array.from({ length: grid.height }, (_, y) =>
    Array.from(
      { length: grid.width },
      (_, x) => grid.get({ x, y })?.terrain ?? "missing",
    ),
  );
}

describe("DefaultGridGenerator", () => {
  it("uses default dimensions when options are not provided", () => {
    const generator = new DefaultGridGenerator();
    const grid = generator.generate();

    expect(grid.width).toBe(DefaultGridGeneratorOptions.width);
    expect(grid.height).toBe(DefaultGridGeneratorOptions.height);
  });

  it("always places two generals with initial troops", () => {
    const generator = new DefaultGridGenerator();
    const grid = generator.generate({ width: 8, height: 6, seed: 1234 });

    const firstGeneral = grid.get({ x: 1, y: 1 });
    const secondGeneral = grid.get({ x: 6, y: 4 });

    expect(firstGeneral?.terrain).toBe(Terrain.GENERAL);
    expect(firstGeneral?.troopCount).toBe(50);
    expect(secondGeneral?.terrain).toBe(Terrain.GENERAL);
    expect(secondGeneral?.troopCount).toBe(50);
  });

  it("produces deterministic terrain for the same seed and options", () => {
    const generator = new DefaultGridGenerator();
    const options = {
      width: 10,
      height: 7,
      seed: 2026,
      mountainRate: 0.2,
      cityRate: 0.15,
    };

    const gridA = generator.generate(options);
    const gridB = generator.generate(options);

    expect(toTerrainMatrix(gridA)).toEqual(toTerrainMatrix(gridB));
  });

  it("respects mountain and city probabilities for non-general cells", () => {
    const generator = new DefaultGridGenerator();

    const allMountains = generator.generate({
      width: 6,
      height: 5,
      seed: 999,
      mountainRate: 1,
      cityRate: 0,
    });

    allMountains.forEach((cell) => {
      const { x, y } = cell.coordinate;
      const isGeneral =
        (x === 1 && y === 1) ||
        (x === allMountains.width - 2 && y === allMountains.height - 2);
      if (!isGeneral) {
        expect(cell.terrain).toBe(Terrain.MOUNTAIN);
      }
    });

    const allCities = generator.generate({
      width: 6,
      height: 5,
      seed: 999,
      mountainRate: 0,
      cityRate: 1,
    });

    allCities.forEach((cell) => {
      const { x, y } = cell.coordinate;
      const isGeneral =
        (x === 1 && y === 1) ||
        (x === allCities.width - 2 && y === allCities.height - 2);
      if (!isGeneral) {
        expect(cell.terrain).toBe(Terrain.CITY);
      }
    });
  });
});
