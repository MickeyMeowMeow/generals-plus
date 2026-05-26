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
    }),
  );
}
