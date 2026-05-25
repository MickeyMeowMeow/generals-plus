/**
 * True grid generator with placement constraints, connectivity validation, and retry logic.
 */
import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import type { ICoordinate } from "#/math/coordinate";
import { SeededRandom } from "#/math/random";

// ── Named constants ──────────────────────────────────────────────────

const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 16;
const DEFAULT_SEED = 20260428;
const DEFAULT_MOUNTAIN_RATE = 0.2;
const DEFAULT_CITY_RATE = 0.02;
const DEFAULT_GENERAL_COUNT = 4;

const MIN_WIDTH = 5;
const MIN_HEIGHT = 5;
const MIN_RATE = 0;
const MAX_RATE = 1;

export const GENERAL_SAFE_RADIUS = 0;
const MIN_GENERAL_DISTANCE_FACTOR = 0.6;
export const MIN_CITY_GENERAL_DISTANCE = 3;
const MIN_CITY_SPACING = 2;
export const MIN_FLAG_SPACING = 3;
export const MIN_FLAG_GENERAL_DISTANCE = 3;
const GENERAL_INITIAL_TROOPS = 50;
const CITY_INITIAL_TROOPS = 50;
const EDGE_MARGIN = 1;
const MAX_RETRY_COUNT = 100;
const MOUNTAIN_CLUSTER_MAX_SIZE = 1;

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

interface ResolvedConfig {
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

// ── DefaultGridGenerator ─────────────────────────────────────────────

/**
 * Pipeline-based grid generator with placement constraints and validation.
 *
 * Flow: resolveOptions → placeGenerals → buildProtectedZones
 *     → paintMountains → placeCities → materializeCells → validateGrid
 *
 * On validation failure, derives a new seed and retries up to MAX_RETRY_COUNT.
 */
export class DefaultGridGenerator implements GridGenerator {
  generate(options: GridGeneratorOptions | DominationGridOptions = {}): Grid {
    const config = this.resolveOptions(options);
    const baseSeed = options.seed ?? DEFAULT_SEED;
    const baseRng = new SeededRandom(options.seed ?? DEFAULT_SEED);

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      const rng =
        attempt === 0 ? baseRng : new SeededRandom(baseSeed + attempt);
      const result = this.tryGenerate(config, rng);
      if (result) {
        return result;
      }
    }

    throw new Error(
      `Grid generation failed after ${MAX_RETRY_COUNT + 1} attempts ` +
        `(${config.width}x${config.height}, ${config.generalCount} generals, ` +
        `mountain=${config.mountainRate}, city=${config.cityRate}).`,
    );
  }

  // ── Pipeline ─────────────────────────────────────────────────────

  private tryGenerate(config: ResolvedConfig, rng: SeededRandom): Grid | null {
    const { width, height } = config;

    const generals = this.placeGenerals(config, rng);
    if (!generals) {
      return null;
    }

    const protectedZone = this.buildProtectedZones(generals, width, height);
    const terrain = this.createTerrainMatrix(width, height);

    for (const g of generals) {
      terrain[g.y][g.x] = Terrain.GENERAL;
    }

    this.paintMountains(config, rng, terrain, protectedZone);

    this.placeCities(config, rng, terrain, protectedZone, generals);

    this.placeFlags(config, rng, terrain, protectedZone, generals);

    if (!this.areAllGeneralsConnected(terrain, generals)) {
      return null;
    }

    const grid = this.materializeCells(terrain, width, height, config);

    return grid;
  }

  // ── Step 0: resolve & validate ───────────────────────────────────

  private resolveOptions(
    options: GridGeneratorOptions | DominationGridOptions,
  ): ResolvedConfig {
    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const mountainRate = options.mountainRate ?? DEFAULT_MOUNTAIN_RATE;
    const cityRate = options.cityRate ?? DEFAULT_CITY_RATE;
    const flagCount = "flagCount" in options ? (options.flagCount ?? 0) : 0;
    const generalCount = options.generalCount ?? DEFAULT_GENERAL_COUNT;
    const minGeneralDistanceFactor =
      options.minGeneralDistanceFactor ?? MIN_GENERAL_DISTANCE_FACTOR;
    const generalInitialTroops =
      options.generalInitialTroops ?? GENERAL_INITIAL_TROOPS;
    const cityInitialTroops = options.cityInitialTroops ?? CITY_INITIAL_TROOPS;

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      throw new Error(
        `Grid dimensions must be at least ${MIN_WIDTH}x${MIN_HEIGHT}, got ${width}x${height}.`,
      );
    }
    if (
      mountainRate < MIN_RATE ||
      mountainRate > MAX_RATE ||
      cityRate < MIN_RATE ||
      cityRate > MAX_RATE
    ) {
      throw new Error(
        `Rates must be in [${MIN_RATE}, ${MAX_RATE}], got mountain=${mountainRate}, city=${cityRate}.`,
      );
    }
    if (generalCount < 1) {
      throw new Error(`General count must be at least 1, got ${generalCount}.`);
    }
    if (flagCount < 0) {
      throw new Error(`Flag count must be at least 0, got ${flagCount}.`);
    }

    return {
      width,
      height,
      mountainRate,
      cityRate,
      flagCount,
      generalCount,
      minGeneralDistanceFactor,
      generalInitialTroops,
      cityInitialTroops,
    };
  }

  // ── Step 1: place generals ───────────────────────────────────────

  private placeGenerals(
    config: ResolvedConfig,
    rng: SeededRandom,
  ): ICoordinate[] | null {
    const { width, height, generalCount } = config;
    const minDistance = Math.floor(
      Math.min(width, height) * config.minGeneralDistanceFactor,
    );

    // Build shuffled candidate pool (interior cells only)
    const candidates: ICoordinate[] = [];
    for (let y = EDGE_MARGIN; y < height - EDGE_MARGIN; y++) {
      for (let x = EDGE_MARGIN; x < width - EDGE_MARGIN; x++) {
        candidates.push({ x, y });
      }
    }
    rng.shuffle(candidates);

    // Greedy selection with all-pairs distance check
    const selected: ICoordinate[] = [];
    for (const candidate of candidates) {
      if (
        selected.every((s) => manhattanDistance(s, candidate) >= minDistance)
      ) {
        selected.push(candidate);
        if (selected.length === generalCount) {
          return selected;
        }
      }
    }

    return null;
  }

  // ── Step 2: protected zones ──────────────────────────────────────

  private buildProtectedZones(
    generals: ICoordinate[],
    width: number,
    height: number,
  ): boolean[][] {
    const zone = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => false),
    );

    for (const g of generals) {
      for (let dy = -GENERAL_SAFE_RADIUS; dy <= GENERAL_SAFE_RADIUS; dy++) {
        for (let dx = -GENERAL_SAFE_RADIUS; dx <= GENERAL_SAFE_RADIUS; dx++) {
          const nx = g.x + dx;
          const ny = g.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            zone[ny][nx] = true;
          }
        }
      }
    }

    return zone;
  }

  // ── Step 3: paint mountains ──────────────────────────────────────

  private paintMountains(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrain: Terrain[][],
    protectedZone: boolean[][],
  ): void {
    const { width, height, mountainRate } = config;
    const totalCells = width * height;
    const targetCount = Math.round(totalCells * mountainRate);

    // Collect placeable cells (not protected, not general)
    const pool: ICoordinate[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!protectedZone[y][x] && terrain[y][x] === Terrain.PLAIN) {
          pool.push({ x, y });
        }
      }
    }
    rng.shuffle(pool);

    // Pick seed points and grow clusters
    let placed = 0;
    for (const seed of pool) {
      if (placed >= targetCount) break;
      if (terrain[seed.y][seed.x] !== Terrain.PLAIN) continue;

      terrain[seed.y][seed.x] = Terrain.MOUNTAIN;
      placed++;

      // Grow cluster from this seed
      let clusterPlaced = 1;
      const clusterSize = 1 + rng.nextInt(MOUNTAIN_CLUSTER_MAX_SIZE);
      const neighbors = this.getShuffledNeighbors(seed, width, height, rng);
      for (const n of neighbors) {
        if (placed >= targetCount) break;
        if (clusterPlaced >= clusterSize) break;
        if (protectedZone[n.y][n.x]) continue;
        if (terrain[n.y][n.x] !== Terrain.PLAIN) continue;

        terrain[n.y][n.x] = Terrain.MOUNTAIN;
        placed++;
        clusterPlaced++;
      }
    }
  }

  // ── Step 4: place cities ─────────────────────────────────────────

  private placeCities(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrain: Terrain[][],
    protectedZone: boolean[][],
    generals: ICoordinate[],
  ): void {
    const { width, height, cityRate } = config;
    const totalCells = width * height;
    const targetCount = Math.round(totalCells * cityRate);

    const pool: ICoordinate[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (
          !protectedZone[y][x] &&
          terrain[y][x] === Terrain.PLAIN &&
          generals.every(
            (g) => manhattanDistance(g, { x, y }) >= MIN_CITY_GENERAL_DISTANCE,
          )
        ) {
          pool.push({ x, y });
        }
      }
    }
    rng.shuffle(pool);

    const placed: ICoordinate[] = [];
    for (const candidate of pool) {
      if (placed.length >= targetCount) break;
      if (
        placed.every((p) => manhattanDistance(p, candidate) >= MIN_CITY_SPACING)
      ) {
        terrain[candidate.y][candidate.x] = Terrain.CITY;
        placed.push(candidate);
      }
    }
  }

  // ── Step 5: place flags (center-weighted) ────────────────────────

  private placeFlags(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrain: Terrain[][],
    protectedZone: boolean[][],
    generals: ICoordinate[],
  ): void {
    if (config.flagCount === 0) return;

    const { width, height, flagCount } = config;
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    const candidates: { coord: ICoordinate; weight: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (
          !protectedZone[y][x] &&
          terrain[y][x] === Terrain.PLAIN &&
          generals.every(
            (g) => manhattanDistance(g, { x, y }) >= MIN_FLAG_GENERAL_DISTANCE,
          )
        ) {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const weight = 1 - dist / maxDist;
          candidates.push({ coord: { x, y }, weight });
        }
      }
    }

    const placed: ICoordinate[] = [];
    for (let i = 0; i < flagCount && candidates.length > 0; i++) {
      const idx = this.weightedRandomIndex(
        candidates.map((c) => c.weight),
        rng,
      );
      const chosen = candidates[idx];
      terrain[chosen.coord.y][chosen.coord.x] = Terrain.FLAG;
      placed.push(chosen.coord);
      candidates.splice(idx, 1);

      // Remove candidates too close to the placed flag
      for (let j = candidates.length - 1; j >= 0; j--) {
        if (
          manhattanDistance(candidates[j].coord, chosen.coord) <
          MIN_FLAG_SPACING
        ) {
          candidates.splice(j, 1);
        }
      }
    }

    if (placed.length !== flagCount) {
      throw new Error(
        `Unable to place requested number of flags: requested ${flagCount}, placed ${placed.length}. ` +
          `Map generation constraints exhausted the candidate pool.`,
      );
    }
  }

  private weightedRandomIndex(weights: number[], rng: SeededRandom): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  // ── Step 6: materialize ──────────────────────────────────────────

  private materializeCells(
    terrain: Terrain[][],
    width: number,
    height: number,
    options: GridGeneratorOptions | DominationGridOptions,
  ): Grid {
    const cells = Array.from({ length: height }, (_, y) =>
      Array.from(
        { length: width },
        (_, x) =>
          new Cell({
            coordinate: { x, y },
            terrain: terrain[y][x],
            troopCount: this.initialTroops(terrain[y][x], options),
          }),
      ),
    );
    return new SquareGrid(width, height, cells);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private createTerrainMatrix(width: number, height: number): Terrain[][] {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => Terrain.PLAIN),
    );
  }

  private getShuffledNeighbors(
    coord: ICoordinate,
    width: number,
    height: number,
    rng: SeededRandom,
  ): ICoordinate[] {
    const offsets: ICoordinate[] = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    const result: ICoordinate[] = [];
    for (const o of offsets) {
      const nx = coord.x + o.x;
      const ny = coord.y + o.y;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        result.push({ x: nx, y: ny });
      }
    }
    return rng.shuffle(result);
  }

  private areAllGeneralsConnected(
    terrain: Terrain[][],
    generals: ICoordinate[],
  ): boolean {
    if (generals.length <= 1) return true;

    const height = terrain.length;
    const width = terrain[0].length;
    const visited = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => false),
    );

    // BFS from first general
    const queue: ICoordinate[] = [generals[0]];
    visited[generals[0].y][generals[0].x] = true;

    while (queue.length > 0) {
      const current = queue?.shift() ?? { x: 0, y: 0 };
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          !visited[ny][nx] &&
          terrain[ny][nx] !== Terrain.MOUNTAIN &&
          terrain[ny][nx] !== Terrain.CITY
        ) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    return generals.every((g) => visited[g.y][g.x]);
  }

  private initialTroops(
    terrain: Terrain,
    options: GridGeneratorOptions | DominationGridOptions,
  ): number | null {
    if (terrain === Terrain.GENERAL)
      return options.generalInitialTroops ?? GENERAL_INITIAL_TROOPS;
    if (terrain === Terrain.CITY)
      return options.cityInitialTroops ?? CITY_INITIAL_TROOPS;
    return null;
  }
}

// ── Free-standing utility ────────────────────────────────────────────

function manhattanDistance(a: ICoordinate, b: ICoordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
