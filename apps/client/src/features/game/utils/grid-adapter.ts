import type {
  ClientVision,
  VisionCellSchema,
} from "@generals-plus/shared-types";

import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import { SquareRenderGrid } from "#/features/game/renderer/render-grid";

/**
 * Adapts the flat Colyseus ClientVision arrays into a structure
 * the GridLayer can iterate over.
 */
export function createRenderGrid(
  vision: ClientVision,
  width: number,
  height: number,
): RenderGrid {
  // Build a lookup of items by coordinate from the flat vision.items array.
  const itemsByCoord = new Map<string, Array<{ id: string; type: number; x: number; y: number }>>();
  if (vision.items && vision.items.length > 0) {
    for (const item of vision.items) {
      const key = `${item.x},${item.y}`;
      if (!itemsByCoord.has(key)) {
        itemsByCoord.set(key, []);
      }
      itemsByCoord.get(key)!.push({
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
      });
    }
  }

  return SquareRenderGrid.fromArray<VisionCellSchema, RenderGridCell>(
    width,
    height,
    vision.cells,
    (cellVision, coordinate) => ({
      coordinate,
      visibility: cellVision.visibility,
      terrain: cellVision.terrain,
      troopCount: cellVision.troopCount === -1 ? null : cellVision.troopCount,
      ownerIndex: cellVision.ownerIndex || null,
      siteIndex: cellVision.siteIndex === -1 ? null : cellVision.siteIndex,
      items: itemsByCoord.get(`${coordinate.x},${coordinate.y}`) ?? null,
    }),
  );
}
