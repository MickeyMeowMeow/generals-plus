import type { Grid, ICoordinate } from "@generals-plus/engine";
import {
  Cell,
  GridType,
  HexGrid,
  HexGrid2D,
  SquareGrid,
} from "@generals-plus/engine";

import type {
  CellTemplate,
  GridTemplate,
  SpawnPoint,
} from "#/infra/db/models/map-model";

export function createGridFromDoc(gridDoc: GridTemplate): Grid {
  const { gridType, cells, track } = gridDoc;
  const bounds = gridDoc.bounds;

  if (gridType === GridType.SQUARE) {
    const { width, height } = bounds as { width: number; height: number };
    const cellObjects = cells.map((row, y) =>
      row.map(
        (c, x) =>
          new Cell({
            coordinate: { x, y },
            terrain: c.terrain,
            troopCount: c.troopCount,
            siteIndex: c.siteIndex,
          }),
      ),
    );
    const grid = new SquareGrid(width, height, cellObjects);
    if (track && track.length > 0) {
      grid.track = track;
    }
    return grid;
  }

  const { left, right, leftSlant, rightSlant } = bounds as {
    left: number;
    right: number;
    leftSlant: number;
    rightSlant: number;
  };
  const cellObjects = cells.map((row, y) => {
    const minX = HexGrid2D.getMinX(y, left);
    return row.map(
      (c, i) =>
        new Cell({
          coordinate: { x: minX + i, y },
          terrain: c.terrain,
          troopCount: c.troopCount,
          siteIndex: c.siteIndex,
        }),
    );
  });
  const grid = new HexGrid(left, right, leftSlant, rightSlant, cellObjects);
  if (track && track.length > 0) {
    grid.track = track;
  }
  return grid;
}

export function buildSpawnMap(
  spawns: SpawnPoint[],
  teamAssignments: Record<string, string>,
  playerIds: string[],
): Map<string, ICoordinate> {
  const teamPlayers = new Map<string, string[]>();
  for (const playerId of playerIds) {
    const teamId = teamAssignments[playerId];
    if (!teamId) continue;
    if (!teamPlayers.has(teamId)) teamPlayers.set(teamId, []);
    teamPlayers.get(teamId)?.push(playerId);
  }

  const result = new Map<string, ICoordinate>();
  for (const spawn of spawns) {
    const players = teamPlayers.get(spawn.teamId) ?? [];
    const player = players[spawn.slot];
    if (player) {
      result.set(player, { x: spawn.x, y: spawn.y });
    }
  }
  return result;
}

export function serializeGrid(grid: Grid, spawns: SpawnPoint[]): GridTemplate {
  const cells: CellTemplate[][] = [];
  grid.forEach((cell) => {
    const y = cell.coordinate.y;
    if (!cells[y]) cells[y] = [];
    cells[y].push({
      terrain: cell.terrain,
      troopCount: cell.troopCount,
      siteIndex: cell.siteIndex,
    });
  });

  const bounds =
    grid.gridType === GridType.SQUARE
      ? { width: grid.width, height: grid.height }
      : {
          left: grid.left,
          right: grid.right,
          leftSlant: grid.leftSlant,
          rightSlant: grid.rightSlant,
        };

  return {
    gridType: grid.gridType,
    bounds,
    cells,
    track:
      grid.track.length > 0 ? grid.track.map((c) => ({ ...c })) : undefined,
    spawns,
  };
}
