import type { Grid } from "#/domain/grid/grid";
import type { GridBounds } from "#/math/grid-2d";
import { GridType } from "#/math/grid-2d";

// ── Named constants ──────────────────────────────────────────────────

export const MIN_WIDTH = 5;
export const MIN_HEIGHT = 5;

export const MIN_RATE = 0;
export const MAX_RATE = 1;

export const MAX_ATTEMPT_COUNT = 100;

export const EDGE_MARGIN = 1;
export const GENERAL_SAFE_RADIUS = 0;

export const MOUNTAIN_CLUSTER_MAX_SIZE = 1;

export const MIN_CITY_GENERAL_DISTANCE = 3;
export const MIN_CITY_SPACING = 2;

export const MIN_FLAG_GENERAL_DISTANCE = 3;
export const MIN_FLAG_SPACING = 3;

// ── Options ──────────────────────────────────────────────────────────

/**
 * Options for grid generation.
 */
export interface GridGeneratorOptions<T extends GridType> {
  readonly gridBounds?: GridBounds[T];
  readonly seed?: number;

  readonly generalCount?: number;
  readonly minGeneralDistanceFactor?: number;
  readonly generalInitialTroops?: number;

  readonly mountainRate?: number;
  readonly cityRate?: number;
  readonly cityInitialTroops?: number;

  readonly flagCount?: number;
}

/** Default options exposed for external reference. */
export const DefaultGenOptions: Omit<
  Required<GridGeneratorOptions<GridType>>,
  "gridBounds"
> = {
  seed: 20260428,

  generalCount: 4,
  minGeneralDistanceFactor: 0.6,
  generalInitialTroops: 50,

  mountainRate: 0.2,
  cityRate: 0.02,
  cityInitialTroops: 50,

  flagCount: 0,
} as const;

export const DefaultGridBounds: {
  [K in GridType]: GridBounds[K];
} = {
  [GridType.SQUARE]: {
    width: 24,
    height: 16,
  },
  [GridType.HEX]: {
    left: 10,
    right: 10,
    leftSlant: 19,
    rightSlant: 19,
  },
} as const;

export interface GridGeneratorOptionsWithType<T extends GridType>
  extends GridGeneratorOptions<T> {
  gridType: T;
}

export type GridGeneratorInput =
  | GridGeneratorOptionsWithType<typeof GridType.SQUARE>
  | GridGeneratorOptionsWithType<typeof GridType.HEX>;

/**
 * Union type representing either a pre-built grid or generation options.
 */
export type GridInput =
  | {
      readonly grid: Grid;
    }
  | GridGeneratorInput;

// ── Resolved config (all fields required) ────────────────────────────

export type ResolvedConfig<T extends GridType = typeof GridType.SQUARE> = Omit<
  Required<GridGeneratorOptions<T>>,
  "seed"
>;
