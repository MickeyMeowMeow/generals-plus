import { Cell } from "#/domain/cell/cell";
import { Terrain } from "#/domain/cell/terrain";
import type { Grid } from "#/domain/grid/grid";
import type {
  GridGeneratorOptions,
  ResolvedConfig,
} from "#/domain/grid/grid-generator/config";
import {
  DefaultGenOptions,
  EDGE_MARGIN,
  GENERAL_SAFE_RADIUS,
  MAX_ATTEMPT_COUNT,
  MAX_RATE,
  MIN_CITY_GENERAL_DISTANCE,
  MIN_CITY_SPACING,
  MIN_FLAG_GENERAL_DISTANCE,
  MIN_FLAG_SPACING,
  MIN_RATE,
  MOUNTAIN_CLUSTER_MAX_SIZE,
} from "#/domain/grid/grid-generator/config";
import type { ICoordinate } from "#/math/coordinate";
import type { GenericGrid2D, GridBounds, GridType } from "#/math/grid-2d";
import { SeededRandom } from "#/math/random";

/**
 * Pipeline-based grid generator with placement constraints and validation.
 *
 * Flow: resolveOptions → placeGenerals → buildProtectedZones
 *     → paintMountains → placeCities → placeFlags
 *     → validateGrid → materializeCells
 *
 * On validation failure, derives a new seed and retries up to MAX_ATTEMPT_COUNT.
 */
export abstract class AbstractGridGenerator<
  T extends GridType,
  TerrainGrid extends GenericGrid2D<Terrain>,
  G extends Grid,
> {
  generate(options: GridGeneratorOptions<T> = {}): G {
    const config = this.resolveOptions(options);
    const seed = options.seed ?? DefaultGenOptions.seed;
    let rng = new SeededRandom(seed);

    for (let attempt = 0; attempt < MAX_ATTEMPT_COUNT; attempt++) {
      const result = this.tryGenerate(config, rng);
      if (result) {
        return result;
      }
      rng = rng.derive();
    }

    throw new Error(
      `Grid generation failed after ${MAX_ATTEMPT_COUNT} attempts ` +
        `(bounds=${JSON.stringify(config.gridBounds)}, generalCount=${config.generalCount}, ` +
        `mountain=${config.mountainRate}, city=${config.cityRate}).`,
    );
  }

  // ── Pipeline ─────────────────────────────────────────────────────

  protected tryGenerate(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
  ): G | null {
    const terrainGrid: TerrainGrid = this.createEmptyTerrainGrid(config);

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

  protected abstract createEmptyTerrainGrid(
    config: ResolvedConfig<T>,
  ): TerrainGrid;

  // ── Step 0: resolve & validate ───────────────────────────────────

  protected resolveOptions(
    options: GridGeneratorOptions<T>,
  ): ResolvedConfig<T> {
    const gridBounds = this.resolveGridBounds(options);

    const mountainRate = options.mountainRate ?? DefaultGenOptions.mountainRate;
    const cityRate = options.cityRate ?? DefaultGenOptions.cityRate;
    const flagCount = "flagCount" in options ? (options.flagCount ?? 0) : 0;
    const generalCount = options.generalCount ?? DefaultGenOptions.generalCount;
    const minGeneralDistanceFactor =
      options.minGeneralDistanceFactor ??
      DefaultGenOptions.minGeneralDistanceFactor;
    const generalInitialTroops =
      options.generalInitialTroops ?? DefaultGenOptions.generalInitialTroops;
    const cityInitialTroops =
      options.cityInitialTroops ?? DefaultGenOptions.cityInitialTroops;

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
      gridBounds,
      mountainRate,
      cityRate,
      flagCount,
      generalCount,
      minGeneralDistanceFactor,
      generalInitialTroops,
      cityInitialTroops,
    };
  }

  protected abstract resolveGridBounds(
    options: GridGeneratorOptions<T>,
  ): GridBounds[T];

  // ── Step 1: place generals ───────────────────────────────────────

  protected placeGenerals(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
  ): ICoordinate[] | null {
    const { generalCount } = config;
    const minDistance = this.calculateMinGeneralDistance(config);

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

  protected abstract calculateMinGeneralDistance(
    config: ResolvedConfig<T>,
  ): number;

  // ── Step 2: protected zones ──────────────────────────────────────

  protected buildProtectedZones(
    generals: ICoordinate[],
    terrainGrid: TerrainGrid,
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

  protected paintMountains(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
    protectedZone: Set<ICoordinate>,
  ): void {
    const { mountainRate } = config;
    const targetCount = Math.round(terrainGrid.totalCells * mountainRate);

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

  protected placeCities(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
    protectedZone: Set<ICoordinate>,
    generals: ICoordinate[],
  ): void {
    const { cityRate } = config;
    const targetCount = Math.round(terrainGrid.totalCells * cityRate);

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

  protected placeFlags(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
    protectedZone: Set<ICoordinate>,
    generals: ICoordinate[],
  ): void {
    const { flagCount } = config;
    if (flagCount === 0) return;

    const maxDist = terrainGrid.getDistanceToCenter({ x: 0, y: 0 });

    const candidates: { coord: ICoordinate; weight: number }[] =
      this.findCandidates(
        protectedZone,
        terrainGrid,
        Terrain.PLAIN,
        generals,
        MIN_FLAG_GENERAL_DISTANCE,
      ).map((coord) => {
        const dist = terrainGrid.getDistanceToCenter(coord);
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

  protected abstract materializeCells(
    terrainGrid: TerrainGrid,
    options: GridGeneratorOptions<T>,
  ): G;

  protected createCell(
    options: GridGeneratorOptions<T>,
    terrain: Terrain,
    coordinate: ICoordinate,
  ): Cell {
    let troopCount: number | null;
    switch (terrain) {
      case Terrain.GENERAL: {
        troopCount =
          options.generalInitialTroops ??
          DefaultGenOptions.generalInitialTroops;
        break;
      }
      case Terrain.CITY: {
        troopCount =
          options.cityInitialTroops ?? DefaultGenOptions.cityInitialTroops;
        break;
      }
      default: {
        troopCount = null;
      }
    }
    return new Cell({ coordinate, terrain, troopCount });
  }

  protected checkGeneralConnectivity(
    terrain: TerrainGrid,
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

  protected findCandidates(
    protectedZone: Set<ICoordinate>,
    terrainGrid: TerrainGrid,
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
