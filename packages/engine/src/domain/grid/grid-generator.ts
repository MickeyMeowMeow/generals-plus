/**
 * @module [TODO:description]
 */
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { Grid } from "#/domain/grid/grid";
import type { IGrid } from "#/domain/grid/interfaces";

/**
 * Options for grid generation.
 */
export interface GridGeneratorOptions {
  /** Number of columns to generate. */
  readonly width?: number;
  /** Number of rows to generate. */
  readonly height?: number;
  /** Seed for reproducible terrain placement. */
  readonly seed?: number;
  /** Probability that a non-general cell becomes a mountain. */
  readonly mountainRate?: number;
  /** Probability that a non-general cell becomes a city after mountain placement. */
  readonly cityRate?: number;
}

/** Default options for grid generation when not provided. */
export const DefaultGridGeneratorOptions: Required<GridGeneratorOptions> = {
  width: 24,
  height: 16,
  seed: 20260425,
  mountainRate: 0.12,
  cityRate: 0.06,
};

/**
 * Grid generator interface for creating new grid instances with configurable options.
 */
export interface GridGenerator {
  generate(options?: GridGeneratorOptions): IGrid;
}

/**
 * Default grid generator that creates a grid with specified dimensions and randomly placed terrains.
 */
export class DefaultGridGenerator implements GridGenerator {
  generate(options: GridGeneratorOptions = {}): IGrid {
    const width = options.width ?? DefaultGridGeneratorOptions.width;
    const height = options.height ?? DefaultGridGeneratorOptions.height;
    const mountainRate =
      options.mountainRate ?? DefaultGridGeneratorOptions.mountainRate;
    const cityRate = options.cityRate ?? DefaultGridGeneratorOptions.cityRate;
    const random = createSeededRandom(
      options.seed ?? DefaultGridGeneratorOptions.seed,
    );

    const generalCoordinates = [
      { x: 1, y: 1 },
      { x: width - 2, y: height - 2 },
    ];

    const cells = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        const isGeneral = generalCoordinates.some(
          (coordinate) => coordinate.x === x && coordinate.y === y,
        );
        const terrain = isGeneral
          ? Terrain.GENERAL
          : pickTerrain(random(), mountainRate, cityRate);

        return new Cell({
          coordinate: { x, y },
          terrain,
          troopCount:
            terrain === Terrain.CITY || terrain === Terrain.GENERAL ? 50 : null,
        });
      }),
    );

    return new Grid(width, height, cells);
  }
}

function pickTerrain(
  value: number,
  mountainRate: number,
  cityRate: number,
): Terrain {
  if (value < mountainRate) {
    return Terrain.MOUNTAIN;
  }

  if (value < mountainRate + cityRate) {
    return Terrain.CITY;
  }

  return Terrain.PLAIN;
}

// TODO: Consider using a more robust PRNG for better randomness, third party libs may be used.
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
