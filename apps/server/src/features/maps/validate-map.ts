import { Terrain } from "@generals-plus/engine";
import type {
  CellTemplate,
  HexGridBounds,
  SquareGridBounds,
} from "@generals-plus/shared-types";

import type { GridTemplate } from "#/infra/db/models/map-model";

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
}

const getMinX = (
  gridType: string,
  bounds: SquareGridBounds | HexGridBounds,
  y: number,
): number => {
  if (gridType === "square") return 0;
  const { left } = bounds as HexGridBounds;
  return Math.max(-left + 1, -y);
};

const getCell = (
  gridType: string,
  bounds: SquareGridBounds | HexGridBounds,
  cells: CellTemplate[][],
  x: number,
  y: number,
) => {
  if (y < 0 || y >= cells.length) return null;
  const row = cells[y];
  if (!row) return null;
  const minX = getMinX(gridType, bounds, y);
  const idx = x - minX;
  return row[idx] ?? null;
};

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

  // Count generals (using absolute coordinates)
  const generalCoords: { x: number; y: number }[] = [];

  for (let y = 0; y < cells.length; y++) {
    const minX = getMinX(gridType, bounds, y);
    for (let idx = 0; idx < cells[y].length; idx++) {
      const cell = cells[y][idx];
      const x = minX + idx; // absolute x coordinate
      if (cell.terrain === Terrain.GENERAL) {
        generalCoords.push({ x, y });
      }
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
    const cell = getCell(gridType, bounds, cells, spawn.x, spawn.y);
    if (!cell) {
      errors.push(`Spawn at (${spawn.x}, ${spawn.y}) is out of bounds`);
    } else if (cell.terrain !== Terrain.GENERAL) {
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
    if (!checkGeneralConnectivity(gridType, bounds, cells, generalCoords)) {
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
  gridType: string,
  bounds: SquareGridBounds | HexGridBounds,
  cells: CellTemplate[][],
  generalCoords: { x: number; y: number }[],
): boolean {
  const passable = (x: number, y: number): boolean => {
    const cell = getCell(gridType, bounds, cells, x, y);
    if (!cell) return false;
    return cell.terrain !== Terrain.MOUNTAIN && cell.terrain !== Terrain.VOID;
  };

  // BFS from first general
  const start = generalCoords[0];
  const visited = new Set<string>();
  const queue = [start];
  visited.add(`${start.x},${start.y}`);

  const offsets =
    gridType === "square"
      ? [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]
      : [
          [0, -1],
          [1, -1],
          [1, 0],
          [0, 1],
          [-1, 1],
          [-1, 0],
        ];

  while (queue.length > 0) {
    const head = queue.shift();
    if (!head) break;
    const { x, y } = head;
    for (const [dx, dy] of offsets) {
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
