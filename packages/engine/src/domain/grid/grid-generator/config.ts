import type { Grid } from "#/domain/grid/grid";

// ── Named constants ──────────────────────────────────────────────────

export const DEFAULT_WIDTH = 24;
export const DEFAULT_HEIGHT = 16;
export const DEFAULT_SEED = 20260428;
export const DEFAULT_MOUNTAIN_RATE = 0.2;
export const DEFAULT_CITY_RATE = 0.02;
export const DEFAULT_GENERAL_COUNT = 4;

export const MIN_WIDTH = 5;
export const MIN_HEIGHT = 5;
export const MIN_RATE = 0;
export const MAX_RATE = 1;

export const GENERAL_SAFE_RADIUS = 0;
export const MIN_GENERAL_DISTANCE_FACTOR = 0.6;
export const MIN_CITY_GENERAL_DISTANCE = 3;
export const MIN_CITY_SPACING = 2;
export const MIN_FLAG_SPACING = 3;
export const MIN_FLAG_GENERAL_DISTANCE = 3;
export const GENERAL_INITIAL_TROOPS = 50;
export const CITY_INITIAL_TROOPS = 50;
export const EDGE_MARGIN = 1;
export const MAX_RETRY_COUNT = 100;
export const MOUNTAIN_CLUSTER_MAX_SIZE = 1;

// ── Options ──────────────────────────────────────────────────────────

/**
 * Base options for grid generation.
 */
export interface GridGeneratorOptions {
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
  readonly mountainRate?: number;
  readonly cityRate?: number;
  readonly generalCount?: number;
  readonly minGeneralDistanceFactor?: number; // expected to be in a narrower range, but TBD
  readonly generalInitialTroops?: number;
  readonly cityInitialTroops?: number;
  readonly flagCount?: number;
}

/**
 * Extended options for Domination mode, adds flag placement.
 */
export interface DominationGridOptions extends GridGeneratorOptions {
  readonly flagCount?: number;
}

/** Default options exposed for external reference. */
export const DefaultGridGeneratorOptions: Required<GridGeneratorOptions> = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  seed: DEFAULT_SEED,
  mountainRate: DEFAULT_MOUNTAIN_RATE,
  cityRate: DEFAULT_CITY_RATE,
  generalCount: DEFAULT_GENERAL_COUNT,
  minGeneralDistanceFactor: MIN_GENERAL_DISTANCE_FACTOR,
  generalInitialTroops: GENERAL_INITIAL_TROOPS,
  cityInitialTroops: CITY_INITIAL_TROOPS,
  flagCount: 0,
};

/**
 * Grid generator interface for creating new grid instances.
 */
export interface GridGenerator {
  generate(options?: GridGeneratorOptions | DominationGridOptions): Grid;
}

/**
 * Union type representing either a pre-built grid or generation options.
 */
export type GridInput =
  | {
      readonly grid: Grid;
    }
  | GridGeneratorOptions
  | DominationGridOptions;

// ── Resolved config (all fields required) ────────────────────────────

export interface ResolvedConfig {
  readonly width: number;
  readonly height: number;
  readonly mountainRate: number;
  readonly cityRate: number;
  readonly flagCount: number;
  readonly generalCount: number;
  readonly minGeneralDistanceFactor: number;
  readonly generalInitialTroops: number;
  readonly cityInitialTroops: number;
}
