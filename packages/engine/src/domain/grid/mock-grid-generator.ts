import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import { Grid } from "#/domain/grid/grid";
import type { IGrid } from "#/domain/grid/interfaces";

/**
 * Options for deterministic local map generation used by renderer smoke tests.
 */
export interface MockGridGeneratorOptions {
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

const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 16;
const DEFAULT_SEED = 20260425;

/**
 * Generates a stable mock grid without depending on server state or networking.
 */
export const MockGridGenerator = {
  /**
   * Builds a complete grid using deterministic terrain distribution.
   */
  generate(options: MockGridGeneratorOptions = {}): IGrid {
    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const mountainRate = options.mountainRate ?? 0.12;
    const cityRate = options.cityRate ?? 0.06;
    const random = createSeededRandom(options.seed ?? DEFAULT_SEED);

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
          : pickMockTerrain(random(), mountainRate, cityRate);

        return new Cell({
          coordinate: { x, y },
          terrain,
          troopCount:
            terrain === Terrain.CITY || terrain === Terrain.GENERAL ? 50 : null,
        });
      }),
    );

    return new Grid(width, height, cells);
  },
} as const;

/**
 * Converts a random value into one of the mock terrain buckets.
 */
function pickMockTerrain(
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

/**
 * Linear congruential generator for reproducible mock maps.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
