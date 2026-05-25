import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import type { Grid } from "#/domain/grid/grid";
import { SquareGrid } from "#/domain/grid/grid";
import type {
  DominationGridOptions,
  GridGenerator,
  GridGeneratorOptions,
  ResolvedConfig,
} from "#/domain/grid/grid-generator/config";
import {
  CITY_INITIAL_TROOPS,
  DEFAULT_CITY_RATE,
  DEFAULT_GENERAL_COUNT,
  DEFAULT_HEIGHT,
  DEFAULT_MOUNTAIN_RATE,
  DEFAULT_SEED,
  DEFAULT_WIDTH,
  EDGE_MARGIN,
  GENERAL_INITIAL_TROOPS,
  GENERAL_SAFE_RADIUS,
  MAX_RATE,
  MAX_RETRY_COUNT,
  MIN_CITY_GENERAL_DISTANCE,
  MIN_CITY_SPACING,
  MIN_FLAG_GENERAL_DISTANCE,
  MIN_FLAG_SPACING,
  MIN_GENERAL_DISTANCE_FACTOR,
  MIN_HEIGHT,
  MIN_RATE,
  MIN_WIDTH,
  MOUNTAIN_CLUSTER_MAX_SIZE,
} from "#/domain/grid/grid-generator/config";
import type { ICoordinate } from "#/math/coordinate";
import { SquareGrid2D } from "#/math/grid-2d";
import { SeededRandom } from "#/math/random";

/**
 * Pipeline-based grid generator with placement constraints and validation.
 *
 * Flow: resolveOptions → placeGenerals → buildProtectedZones
 *     → paintMountains → placeCities → materializeCells → validateGrid
 *
 * On validation failure, derives a new seed and retries up to MAX_RETRY_COUNT.
 */
export class SquareGridGenerator implements GridGenerator {
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

    const terrainGrid: SquareGrid2D<Terrain> = SquareGrid2D.generate(
      width,
      height,
      () => Terrain.PLAIN,
    );

    const generals = this.placeGenerals(config, rng, terrainGrid);
    if (!generals) {
      return null;
    }

    const protectedZone = this.buildProtectedZones(generals, terrainGrid);

    this.paintMountains(config, rng, terrainGrid, protectedZone);

    this.placeCities(config, rng, terrainGrid, protectedZone, generals);

    this.placeFlags(config, rng, terrainGrid, protectedZone, generals);

    if (!this.checkGeneralConnectivity(terrainGrid, generals)) {
      return null;
    }

    const grid = this.materializeCells(terrainGrid, config);

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
    terrainGrid: SquareGrid2D<Terrain>,
  ): ICoordinate[] | null {
    const { width, height, generalCount } = config;
    const minDistance = Math.floor(
      Math.min(width, height) * config.minGeneralDistanceFactor,
    );

    // Build shuffled candidate pool (interior cells only)
    const candidates: ICoordinate[] =
      terrainGrid.getInteriorCoordinates(EDGE_MARGIN);
    rng.shuffle(candidates);

    // Greedy selection with all-pairs distance check
    const selected: ICoordinate[] = [];
    for (const candidate of candidates) {
      const isTooCloseToExisting = selected.some(
        (s) => terrainGrid.getDistance(s, candidate) < minDistance,
      );
      if (isTooCloseToExisting) {
        continue;
      }

      selected.push(candidate);
      terrainGrid.set(candidate, Terrain.GENERAL);
      if (selected.length === generalCount) {
        return selected;
      }
    }

    return null;
  }

  // ── Step 2: protected zones ──────────────────────────────────────

  private buildProtectedZones(
    generals: ICoordinate[],
    terrainGrid: SquareGrid2D<Terrain>,
  ): Set<ICoordinate> {
    const zone = new Set<ICoordinate>();

    for (const g of generals) {
      terrainGrid.forEachInRadius(g, GENERAL_SAFE_RADIUS, (_, coord) => {
        zone.add(coord);
      });
    }

    return zone;
  }

  // ── Step 3: paint mountains ──────────────────────────────────────

  private paintMountains(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrainGrid: SquareGrid2D<Terrain>,
    protectedZone: Set<ICoordinate>,
  ): void {
    const { width, height, mountainRate } = config;
    const totalCells = width * height;
    const targetCount = Math.round(totalCells * mountainRate);

    // Collect placeable cells (not protected and currently plain) into a pool
    const pool: ICoordinate[] = this.findCandidates(
      protectedZone,
      terrainGrid,
      Terrain.PLAIN,
      [],
      0,
    );
    rng.shuffle(pool);

    // Pick seed points and grow clusters
    let placed = 0;
    for (const seed of pool) {
      if (placed >= targetCount) break;
      if (terrainGrid.get(seed) !== Terrain.PLAIN) continue;

      terrainGrid.set(seed, Terrain.MOUNTAIN);
      placed++;

      // Grow cluster from this seed
      const clusterSize = Math.min(
        targetCount - placed, // Ensure we don't exceed target
        rng.nextInt(MOUNTAIN_CLUSTER_MAX_SIZE), // Exclude seed itself
      );
      const plainNeighbors = terrainGrid
        .getNeighbors(seed)
        .filter(([c, t]) => t === Terrain.PLAIN && !protectedZone.has(c));
      const shuffledNeighbors = rng
        .shuffle(plainNeighbors)
        .slice(0, clusterSize);
      for (const [coord, _] of shuffledNeighbors) {
        terrainGrid.set(coord, Terrain.MOUNTAIN);
        placed++;
      }
    }
  }

  // ── Step 4: place cities ─────────────────────────────────────────

  private placeCities(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrainGrid: SquareGrid2D<Terrain>,
    protectedZone: Set<ICoordinate>,
    generals: ICoordinate[],
  ): void {
    const { width, height, cityRate } = config;
    const totalCells = width * height;
    const targetCount = Math.round(totalCells * cityRate);

    const pool: ICoordinate[] = this.findCandidates(
      protectedZone,
      terrainGrid,
      Terrain.PLAIN,
      generals,
      MIN_CITY_GENERAL_DISTANCE,
    );
    rng.shuffle(pool);

    const placed: ICoordinate[] = [];
    for (const candidate of pool) {
      if (placed.length >= targetCount) break;
      const notTooCloseToExistingCity = placed.every(
        (p) => terrainGrid.getDistance(p, candidate) >= MIN_CITY_SPACING,
      );
      if (notTooCloseToExistingCity) {
        terrainGrid.set(candidate, Terrain.CITY);
        placed.push(candidate);
      }
    }
  }

  // ── Step 5: place flags (center-weighted) ────────────────────────

  private placeFlags(
    config: ResolvedConfig,
    rng: SeededRandom,
    terrainGrid: SquareGrid2D<Terrain>,
    protectedZone: Set<ICoordinate>,
    generals: ICoordinate[],
  ): void {
    const { flagCount } = config;
    if (flagCount === 0) return;

    const cx = (terrainGrid.width - 1) / 2;
    const cy = (terrainGrid.height - 1) / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    const candidates: { coord: ICoordinate; weight: number }[] =
      this.findCandidates(
        protectedZone,
        terrainGrid,
        Terrain.PLAIN,
        generals,
        MIN_FLAG_GENERAL_DISTANCE,
      ).map((coord) => {
        const dist = Math.sqrt((coord.x - cx) ** 2 + (coord.y - cy) ** 2);
        const weight = 1 - dist / maxDist;
        return { coord, weight };
      });

    let placed = 0;
    for (let i = 0; i < flagCount && candidates.length > 0; i++) {
      const idx = rng.weightedIndex(candidates.map((c) => c.weight));
      const { coord } = candidates[idx];

      terrainGrid.set(coord, Terrain.FLAG);
      placed++;
      candidates.splice(idx, 1);

      // Remove candidates too close to the placed flag
      for (let j = candidates.length - 1; j >= 0; j--) {
        if (
          terrainGrid.getDistance(candidates[j].coord, coord) < MIN_FLAG_SPACING
        ) {
          candidates.splice(j, 1);
        }
      }
    }

    if (placed !== flagCount) {
      throw new Error(
        `Unable to place requested number of flags: requested ${flagCount}, placed ${placed}. ` +
          `Map generation constraints exhausted the candidate pool.`,
      );
    }
  }

  // ── Step 6: materialize ──────────────────────────────────────────

  private materializeCells(
    terrainGrid: SquareGrid2D<Terrain>,
    options: GridGeneratorOptions | DominationGridOptions,
  ): Grid {
    const cells = terrainGrid.map((terrain, coordinate) =>
      this.createCell(options, terrain, coordinate),
    );
    return new SquareGrid(cells.width, cells.height, cells.gridData);
  }

  private checkGeneralConnectivity(
    terrain: SquareGrid2D<Terrain>,
    generals: ICoordinate[],
  ): boolean {
    if (generals.length <= 1) return true;

    const visited = terrain.map(() => false);

    // BFS from first general
    const queue: ICoordinate[] = [generals[0]];
    visited.set(generals[0], true);

    while (queue.length > 0) {
      const current = queue?.shift() ?? { x: 0, y: 0 };
      const neighbors = terrain.getNeighbors(current);
      for (const [coord, terrain] of neighbors) {
        if (
          !visited.get(coord) &&
          terrain !== Terrain.MOUNTAIN &&
          terrain !== Terrain.CITY
        ) {
          visited.set(coord, true);
          queue.push(coord);
        }
      }
    }

    return generals.every((g) => visited.get(g));
  }

  private createCell(
    options: GridGeneratorOptions | DominationGridOptions,
    terrain: Terrain,
    coordinate: ICoordinate,
  ): Cell {
    let troopCount: number | null;
    switch (terrain) {
      case Terrain.GENERAL: {
        troopCount = options.generalInitialTroops ?? GENERAL_INITIAL_TROOPS;
        break;
      }
      case Terrain.CITY: {
        troopCount = options.cityInitialTroops ?? CITY_INITIAL_TROOPS;
        break;
      }
      default: {
        troopCount = null;
      }
    }
    return new Cell({ coordinate, terrain, troopCount });
  }

  private findCandidates(
    protectedZone: Set<ICoordinate>,
    terrainGrid: SquareGrid2D<Terrain>,
    expectedTerrain: Terrain,
    farFrom: ICoordinate[],
    minDistance: number,
  ) {
    const candidates: ICoordinate[] = [];
    for (const [coord, terrain] of terrainGrid.entries()) {
      if (protectedZone.has(coord) || terrain !== expectedTerrain) {
        continue;
      }
      const notTooCloseToFar = farFrom.every(
        (f) => terrainGrid.getDistance(f, coord) >= minDistance,
      );
      if (notTooCloseToFar) {
        candidates.push(coord);
      }
    }
    return candidates;
  }
}
