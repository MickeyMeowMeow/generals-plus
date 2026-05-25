import type { Grid } from "#/domain/grid/grid";

// ── Named constants ──────────────────────────────────────────────────

export const MIN_WIDTH = 5;
export const MIN_HEIGHT = 5;
export const MIN_RATE = 0;
export const MAX_RATE = 1;

export const GENERAL_SAFE_RADIUS = 0;
export const MIN_CITY_GENERAL_DISTANCE = 3;
export const MIN_CITY_SPACING = 2;
export const MIN_FLAG_SPACING = 3;
export const MIN_FLAG_GENERAL_DISTANCE = 3;
export const EDGE_MARGIN = 1;
export const MAX_ATTEMPT_COUNT = 100;
export const MOUNTAIN_CLUSTER_MAX_SIZE = 1;

// ── Options ──────────────────────────────────────────────────────────

/**
 * Options for grid generation.
 */
export interface GridGeneratorOptions {
  readonly gridBounds?: { width: number; height: number };
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
export const DefaultGenOptions: Required<GridGeneratorOptions> = {
  gridBounds: { width: 24, height: 16 },
  seed: 20260428,

  generalCount: 4,
  minGeneralDistanceFactor: 0.6,
  generalInitialTroops: 50,

  mountainRate: 0.2,
  cityRate: 0.02,
  cityInitialTroops: 50,

  flagCount: 0,
};

/**
 * Grid generator interface for creating new grid instances.
 */
export interface GridGenerator {
  generate(options?: GridGeneratorOptions): Grid;
}

/**
 * Union type representing either a pre-built grid or generation options.
 */
export type GridInput =
  | {
      readonly grid: Grid;
    }
  | GridGeneratorOptions;

// ── Resolved config (all fields required) ────────────────────────────

export type ResolvedConfig = Omit<Required<GridGeneratorOptions>, "seed">;
