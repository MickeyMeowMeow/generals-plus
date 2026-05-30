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

function coordToString(coord: ICoordinate): string {
  return `${coord.x},${coord.y}`;
}

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
  protected bombSites: ICoordinate[] = [];

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
    this.bombSites = [];
    const terrainGrid: TerrainGrid = this.createEmptyTerrainGrid(config);

    const generals = this.placeGenerals(config, rng, terrainGrid);
    if (!generals) {
      return null;
    }

    const protectedZone = this.buildProtectedZones(generals, terrainGrid);

    if ((config as any).isPayload) {
      const bounds = terrainGrid.bounds as any;
      const width = terrainGrid.gridType === "square" ? (terrainGrid as any).width : (bounds.left + bounds.right);
      const height = terrainGrid.gridType === "square" ? (terrainGrid as any).height : (bounds.leftSlant);
      const cy = Math.floor(height / 2);

      const K = (config as any).payloadCartSize ?? 3;
      const startOffset = -Math.floor((K - 1) / 2);
      const endOffset = Math.floor(K / 2);

      // Safe track bounds so the KxK cart never overlaps with generals at x = 1 and x = W - 2
      const startX = Math.min(2 - startOffset, Math.floor(width / 2));
      const endX = Math.max(startX, width - 1 - (2 - startOffset));

      for (let x = startX; x <= endX; x++) {
        for (let dy = startOffset; dy <= endOffset; dy++) {
          for (let dx = startOffset; dx <= endOffset; dx++) {
            const coord = { x: x + dx, y: cy + dy };
            if (terrainGrid.isValid(coord)) {
              protectedZone.add(`${coord.x},${coord.y}`);
              if (terrainGrid.get(coord) !== Terrain.GENERAL) {
                terrainGrid.set(coord, Terrain.PLAIN);
              }
            }
          }
        }
      }
    }

    this.paintMountains(config, rng, terrainGrid, protectedZone);

    this.placeCities(config, rng, terrainGrid, protectedZone, generals);

    this.placeFlags(config, rng, terrainGrid, protectedZone, generals);

    this.placeBombSites(config, rng, terrainGrid, protectedZone, generals);

    if (!this.checkGeneralConnectivity(terrainGrid, generals)) {
      return null;
    }

    const grid = this.materializeCells(terrainGrid, config);

    if ((config as any).isPayload) {
      const track: ICoordinate[] = [];
      const cy = Math.floor(grid.height / 2);
      const K = (config as any).payloadCartSize ?? 3;
      const startOffset = -Math.floor((K - 1) / 2);
      const startX = Math.min(2 - startOffset, Math.floor(grid.width / 2));
      const endX = Math.max(startX, grid.width - 1 - (2 - startOffset));
      for (let x = startX; x <= endX; x++) {
        track.push({ x, y: cy });
      }
      grid.track = track;
    }

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
    const bombSiteCount =
      "bombSiteCount" in options ? (options.bombSiteCount ?? 0) : 0;
    const isPayload = "isPayload" in options ? !!options.isPayload : false;
    const payloadCartSize = "payloadCartSize" in options ? (options.payloadCartSize ?? 3) : 3;
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
    if (bombSiteCount < 0) {
      throw new Error(
        `Bomb site count must be at least 0, got ${bombSiteCount}.`,
      );
    }

    return {
      gridBounds,
      mountainRate,
      cityRate,
      flagCount,
      bombSiteCount,
      generalCount,
      minGeneralDistanceFactor,
      generalInitialTroops,
      cityInitialTroops,
      isPayload,
      payloadCartSize,
    } as any;
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

    if ((config as any).isPayload) {
      const bounds = terrainGrid.bounds as any;
      const width = terrainGrid.gridType === "square" ? (terrainGrid as any).width : (bounds.left + bounds.right);
      const height = terrainGrid.gridType === "square" ? (terrainGrid as any).height : (bounds.leftSlant);
      const cy = Math.floor(height / 2);

      const selected: ICoordinate[] = [];
      const halfCount = Math.ceil(generalCount / 2);

      // Left side candidates: x = 1, y = cy, cy - 1, cy + 1, ...
      for (let i = 0; i < halfCount; i++) {
        const yOffset = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
        const y = cy + yOffset;
        if (y >= 1 && y < height - 1) {
          selected.push({ x: 1, y });
        }
      }

      // Right side candidates: x = W - 2, y = cy, cy - 1, cy + 1, ...
      const rightCount = generalCount - selected.length;
      for (let i = 0; i < rightCount; i++) {
        const yOffset = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
        const y = cy + yOffset;
        if (y >= 1 && y < height - 1) {
          selected.push({ x: width - 2, y });
        }
      }

      for (const g of selected) {
        terrainGrid.set(g, Terrain.GENERAL);
      }
      return selected;
    }

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
  ): Set<string> {
    const zone = new Set<string>();

    for (const g of generals) {
      terrainGrid.forEachInRadius(g, GENERAL_SAFE_RADIUS, (_, coord) => {
        zone.add(coordToString(coord));
      });
    }

    return zone;
  }

  // ── Step 3: paint mountains ──────────────────────────────────────

  protected paintMountains(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
    protectedZone: Set<string>,
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
        .filter(
          ([c, t]) =>
            t === Terrain.PLAIN && !protectedZone.has(coordToString(c)),
        );
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
    protectedZone: Set<string>,
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
    protectedZone: Set<string>,
    generals: ICoordinate[],
  ): void {
    const { flagCount } = config;
    if (flagCount === 0) return;

    const coords: ICoordinate[] = this.findCandidates(
      protectedZone,
      terrainGrid,
      Terrain.PLAIN,
      generals,
      MIN_FLAG_GENERAL_DISTANCE,
    );

    const distances: number[] = coords.map((coord) =>
      terrainGrid.getDistanceToCenter(coord),
    );

    const maxDist = Math.max(...distances);

    const candidates: { coord: ICoordinate; weight: number }[] = coords.map(
      (coord, idx) => ({ coord, weight: maxDist - distances[idx] }),
    );

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

  // ── Step 5b: place bomb sites (center-weighted) ──────────────────

  protected placeBombSites(
    config: ResolvedConfig<T>,
    rng: SeededRandom,
    terrainGrid: TerrainGrid,
    protectedZone: Set<string>,
    generals: ICoordinate[],
  ): void {
    const { bombSiteCount } = config;
    if (bombSiteCount === 0) return;

    const coords: ICoordinate[] = this.findCandidates(
      protectedZone,
      terrainGrid,
      Terrain.PLAIN,
      generals,
      3, // MIN_FLAG_GENERAL_DISTANCE
    );

    const distances: number[] = coords.map((coord) =>
      terrainGrid.getDistanceToCenter(coord),
    );

    const maxDist = Math.max(...distances);

    const candidates: { coord: ICoordinate; weight: number }[] = coords.map(
      (coord, idx) => ({ coord, weight: maxDist - distances[idx] }),
    );

    let placed = 0;
    for (let i = 0; i < bombSiteCount && candidates.length > 0; i++) {
      const idx = rng.weightedIndex(candidates.map((c) => c.weight));
      const { coord } = candidates[idx];

      terrainGrid.set(coord, Terrain.BOMB_SITE);
      this.bombSites.push(coord);
      placed++;
      candidates.splice(idx, 1);

      // Remove candidates too close to the placed bomb site
      for (let j = candidates.length - 1; j >= 0; j--) {
        if (terrainGrid.getDistance(candidates[j].coord, coord) < 3) {
          candidates.splice(j, 1);
        }
      }
    }

    if (placed !== bombSiteCount) {
      throw new Error(
        `Unable to place requested number of bomb sites: requested ${bombSiteCount}, placed ${placed}. ` +
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
    let siteIndex: number | null = null;
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
      case Terrain.BOMB_SITE: {
        troopCount = null;
        const index = this.bombSites.findIndex(
          (c) => c.x === coordinate.x && c.y === coordinate.y,
        );
        siteIndex = index !== -1 ? index : null;
        break;
      }
      default: {
        troopCount = null;
      }
    }
    return new Cell({ coordinate, terrain, troopCount, siteIndex });
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
    protectedZone: Set<string>,
    terrainGrid: TerrainGrid,
    expectedTerrain: Terrain,
    farFrom: ICoordinate[],
    minDistance: number,
  ) {
    const candidates: ICoordinate[] = [];
    for (const [coord, terrain] of terrainGrid.entries()) {
      if (
        protectedZone.has(coordToString(coord)) ||
        terrain !== expectedTerrain
      ) {
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
