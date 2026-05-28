import type { GridShape, ICoordinate } from "@generals-plus/engine";
import { GridType } from "@generals-plus/engine";
import type {
  ClientVision,
  VisionCellSchema,
} from "@generals-plus/shared-types";

import type {
  RenderGrid,
  RenderGridCell,
} from "#/features/game/renderer/render-grid";
import {
  HexRenderGrid,
  SquareRenderGrid,
} from "#/features/game/renderer/render-grid";

/**
 * Adapts the flat Colyseus ClientVision arrays into a structure
 * the GridLayer can iterate over.
 */
export function createRenderGrid(
  vision: ClientVision,
  shape: GridShape,
): RenderGrid {
  const createCell = (
    cellVision: VisionCellSchema,
    coordinate: ICoordinate,
  ) => ({
    coordinate,
    visibility: cellVision.visibility,
    terrain: cellVision.terrain,
    troopCount: cellVision.troopCount === -1 ? null : cellVision.troopCount,
    ownerIndex: cellVision.ownerIndex || null,
    siteIndex: cellVision.siteIndex === -1 ? null : cellVision.siteIndex,
    item:
      cellVision.item_type !== -1
        ? { id: cellVision.item_id, type: cellVision.item_type }
        : null,
    willCollapse: cellVision.willCollapse,
  });

  switch (shape.gridType) {
    case GridType.SQUARE: {
      return SquareRenderGrid.fromArray<VisionCellSchema, RenderGridCell>(
        shape.width,
        shape.height,
        vision.cells,
        createCell,
      );
    }
    case GridType.HEX: {
      return HexRenderGrid.fromArray<VisionCellSchema, RenderGridCell>(
        shape.left,
        shape.right,
        shape.leftSlant,
        shape.rightSlant,
        vision.cells,
        createCell,
      );
    }
  }
}
