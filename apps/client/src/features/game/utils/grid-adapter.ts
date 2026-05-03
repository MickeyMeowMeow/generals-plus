import type { Terrain, Visibility } from "@generals-plus/engine";
import type { ClientVision } from "@generals-plus/shared-types";

import type { RenderGridCell } from "#/features/game/renderer/render-grid";
import { RenderGrid } from "#/features/game/renderer/render-grid";

/**
 * Adapts the flat Colyseus ClientVision arrays into a structure
 * the GridLayer can iterate over.
 */
export function createRenderGrid(
  vision: ClientVision,
  width: number,
  height: number,
): RenderGrid {
  const cellGrid: RenderGridCell[][] = [];

  for (let y = 0; y < height; y++) {
    cellGrid[y] = [];
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      cellGrid[y].push({
        coordinate: { x, y },
        terrain: vision.terrain[index] as Terrain,
        troopCount:
          vision.troopCount[index] === -1 ? null : vision.troopCount[index],
        visibility: vision.visibility[index] as Visibility,
        ownerIndex: vision.ownerIndex[index] || null,
      });
    }
  }

  return new RenderGrid(width, height, cellGrid);
}
