import type {
  GridShape,
  ICoordinate,
  VisionTerrain,
} from "@generals-plus/engine";
import {
  GridType,
  HexGrid2D,
  SquareGrid2D,
  Terrain,
  Visibility,
} from "@generals-plus/engine";
import type { VisionCellSchema } from "@generals-plus/shared-types";

export interface RenderGridCell {
  coordinate: ICoordinate;
  terrain: VisionTerrain;
  troopCount: number | null;
  visibility: Visibility;
  ownerIndex: string | null;
  siteIndex: number | null;
  item: { id: string; type: number } | null;
}

export class SquareRenderGrid extends SquareGrid2D<RenderGridCell> {}

export class HexRenderGrid extends HexGrid2D<RenderGridCell> {}

export type RenderGrid = SquareRenderGrid | HexRenderGrid;

export function createRenderGrid(shape: GridShape): RenderGrid {
  const createNullCell = (coordinate: ICoordinate): RenderGridCell => ({
    coordinate,
    visibility: Visibility.HIDDEN,
    terrain: Terrain.VOID,
    troopCount: null,
    ownerIndex: null,
    siteIndex: null,
    item: null,
  });

  switch (shape.gridType) {
    case GridType.SQUARE: {
      return SquareRenderGrid.generate<RenderGridCell>(
        shape.width,
        shape.height,
        createNullCell,
      );
    }
    case GridType.HEX: {
      return HexRenderGrid.generate<RenderGridCell>(
        shape.left,
        shape.right,
        shape.leftSlant,
        shape.rightSlant,
        createNullCell,
      );
    }
  }
}

export function updateRenderGrid(
  grid: RenderGrid,
  visionCells: VisionCellSchema[],
) {
  const createVisionCell = (
    newVision: VisionCellSchema,
    _currentCell: RenderGridCell,
    coordinate: ICoordinate,
  ) => {
    return {
      coordinate,
      visibility: newVision.visibility,
      terrain: newVision.terrain,
      troopCount: newVision.troopCount === -1 ? null : newVision.troopCount,
      ownerIndex: newVision.ownerIndex || null,
      siteIndex: newVision.siteIndex === -1 ? null : newVision.siteIndex,
      item:
        newVision.item_type !== -1
          ? { id: newVision.item_id, type: newVision.item_type }
          : null,
    };
  };

  grid.updateFromArray(visionCells, createVisionCell);
}
