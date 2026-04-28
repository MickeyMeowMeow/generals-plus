import type { Terrain, Visibility } from "@generals-plus/engine";
import type { ClientVision } from "@generals-plus/shared-types";

import type { RenderGridCell } from "#/features/game/renderer/grid-layer";
import { RenderGrid } from "#/features/game/renderer/grid-layer";

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

  console.log(
    "Creating render grid with vision data:",
    vision.terrain.length,
    vision.troopCount.length,
    vision.ownerIndex.length,
    vision.visibility.length,
  );

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

  console.log("Constructed cell grid:", cellGrid);

  return new RenderGrid(width, height, cellGrid);
}
