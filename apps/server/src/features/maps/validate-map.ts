import { Terrain } from "@generals-plus/engine";

import type { GridTemplate } from "#/infra/db/models/map-model";

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMapGrid(grid: GridTemplate): MapValidationResult {
  const errors: string[] = [];
  const { gridType, bounds, cells, spawns } = grid;
  const boundsRecord = bounds as unknown as Record<string, number>;

  // Validate cells dimensions
  if (gridType === "square") {
    const { width, height } = boundsRecord;
    if (cells.length !== height) {
      errors.push(`Expected ${height} rows, got ${cells.length}`);
    }
    for (let y = 0; y < cells.length; y++) {
      if (cells[y].length !== width) {
        errors.push(
          `Row ${y}: expected ${width} cells, got ${cells[y].length}`,
        );
      }
    }
  } else {
    const { left, right, leftSlant, rightSlant } = boundsRecord;
    if (cells.length !== leftSlant) {
      errors.push(`Expected ${leftSlant} rows, got ${cells.length}`);
    }
    for (let y = 0; y < cells.length; y++) {
      const minX = Math.max(-left + 1, -y);
      const maxX = Math.min(right - 1, rightSlant - y - 1);
      const expected = maxX - minX + 1;
      if (cells[y].length !== expected) {
        errors.push(
          `Row ${y}: expected ${expected} cells, got ${cells[y].length}`,
        );
      }
    }
  }

  // Count generals
  const generalCoords: { x: number; y: number }[] = [];
  let _flagCount = 0;
  let _bombSiteCount = 0;

  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      const cell = cells[y][x];
      if (cell.terrain === Terrain.GENERAL) {
        generalCoords.push({ x, y });
      }
      if (cell.terrain === Terrain.FLAG) _flagCount++;
      if (cell.terrain === Terrain.BOMB_SITE) _bombSiteCount++;
    }
  }

  if (generalCoords.length < 2) {
    errors.push("Map must have at least 2 generals");
  }

  // Validate spawns
  if (spawns.length < 2) {
    errors.push("Map must have at least 2 spawn points");
  }

  const spawnKeys = new Set<string>();
  for (const spawn of spawns) {
    const key = `${spawn.teamId}:${spawn.slot}`;
    if (spawnKeys.has(key)) {
      errors.push(`Duplicate spawn: team ${spawn.teamId} slot ${spawn.slot}`);
    }
    spawnKeys.add(key);

    // Check spawn coordinate is a general cell
    const row = cells[spawn.y];
    if (!row || spawn.x >= row.length) {
      errors.push(`Spawn at (${spawn.x}, ${spawn.y}) is out of bounds`);
    } else if (row[spawn.x].terrain !== Terrain.GENERAL) {
      errors.push(`Spawn at (${spawn.x}, ${spawn.y}) is not on a general cell`);
    }
  }

  // Check spawn count matches general count
  if (spawns.length !== generalCoords.length) {
    errors.push(
      `Spawn count (${spawns.length}) does not match general count (${generalCoords.length})`,
    );
  }

  // Validate connectivity between generals
  if (generalCoords.length >= 2) {
    if (!checkGeneralConnectivity(cells, generalCoords)) {
      errors.push("Not all generals are reachable from each other");
    }
  }

  // Mode-specific checks are done at the route level using supportedModes

  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkGeneralConnectivity(
  cells: { terrain: string }[][],
  generalCoords: { x: number; y: number }[],
): boolean {
  const height = cells.length;
  const passable = (x: number, y: number): boolean => {
    if (y < 0 || y >= height) return false;
    const row = cells[y];
    if (!row || x < 0 || x >= row.length) return false;
    const t = row[x].terrain;
    return t !== Terrain.MOUNTAIN && t !== Terrain.VOID;
  };

  // BFS from first general
  const start = generalCoords[0];
  const visited = new Set<string>();
  const queue = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const head = queue.shift();
    if (!head) break;
    const { x, y } = head;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && passable(nx, ny)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return generalCoords.every((g) => visited.has(`${g.x},${g.y}`));
}
